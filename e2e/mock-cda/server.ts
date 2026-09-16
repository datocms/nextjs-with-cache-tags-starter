/**
 * A tiny stand-in for the DatoCMS Content Delivery API, good enough to serve
 * every GraphQL operation used by this project and to return `X-Cache-Tags`
 * headers like the real thing.
 *
 * Besides the `/graphql` endpoint it exposes a few `/__control/*` endpoints
 * that let the tests mutate the content, inspect the requests received, and
 * reset everything between test files.
 *
 * Cache tags are deterministic and readable (`post:post-1`, `author:author-1`,
 * `post-list`, `site`), which makes it easy to assert on selective
 * invalidation.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {
  type AuthorFixture,
  type ContentState,
  createInitialState,
  type PostFixture,
} from './fixtures.ts';

type GraphQLRequest = {
  operationName?: string;
  query: string;
  variables?: Record<string, unknown>;
};

type OperationResult = { data: unknown; cacheTags: string[] };

/** A valid 1x1 JPEG, returned for every `/images/*` request. */
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

export type ReceivedRequest = {
  operationName: string;
  variables: Record<string, unknown>;
  token: string | null;
};

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

const json = (
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const structuredText = (post: PostFixture) => ({
  value: {
    schema: 'dast',
    document: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'span', value: post.body }],
        },
        ...(post.coverImage
          ? [{ type: 'block', item: `${post.id}-image-block` }]
          : []),
      ],
    },
  },
  blocks: post.coverImage
    ? [
        {
          __typename: 'ImageBlockRecord',
          id: `${post.id}-image-block`,
          image: post.coverImage,
        },
      ]
    : [],
});

const postSummary = ({ id, title, slug, publishedAt }: PostFixture) => ({
  id,
  title,
  slug,
  _publishedAt: publishedAt,
});

const byPublishedAtDesc = (a: PostFixture, b: PostFixture) =>
  b.publishedAt.localeCompare(a.publishedAt);

const authorOf = (
  state: ContentState,
  post: PostFixture,
): AuthorFixture | null =>
  state.authors.find((author) => author.id === post.authorId) ?? null;

/**
 * Resolves one of the project's GraphQL operations against the current state.
 * Operations are matched by name, since the queries are fixed and typed.
 */
const resolveOperation = (
  state: ContentState,
  { operationName, variables = {} }: GraphQLRequest,
): OperationResult => {
  const posts = [...state.posts].sort(byPublishedAtDesc);

  switch (operationName) {
    case 'LastPost': {
      const lastPost = posts[0] ?? null;
      return {
        data: { lastPost: lastPost ? { slug: lastPost.slug } : null },
        cacheTags: ['site', 'post-list'],
      };
    }

    case 'RecentPosts': {
      const recentPosts = posts.slice(0, 3);
      return {
        data: { recentPosts: recentPosts.map(postSummary) },
        cacheTags: [
          'site',
          'post-list',
          ...recentPosts.map((post) => `post:${post.id}`),
        ],
      };
    }

    case 'CurrentPost': {
      const post =
        posts.find((candidate) => candidate.slug === variables.slug) ?? null;

      if (!post) {
        return {
          data: { currentPost: null },
          cacheTags: ['site', 'post-list'],
        };
      }

      const author = authorOf(state, post);

      return {
        data: {
          currentPost: {
            title: post.title,
            content: structuredText(post),
            coverImage: post.coverImage,
            _firstPublishedAt: post.publishedAt,
            author: author ? { id: author.id, name: author.name } : null,
          },
        },
        cacheTags: [
          'site',
          `post:${post.id}`,
          ...(author ? [`author:${author.id}`] : []),
        ],
      };
    }

    case 'PreviousAndNextPosts': {
      const firstPublishedAt = String(variables.firstPublishedAt);
      const others = posts.filter((post) => post.slug !== variables.slug);

      const previousPost =
        others.find((post) => post.publishedAt < firstPublishedAt) ?? null;
      const nextPost =
        [...others]
          .reverse()
          .find((post) => post.publishedAt > firstPublishedAt) ?? null;

      const pick = (post: PostFixture | null) =>
        post ? { id: post.id, title: post.title, slug: post.slug } : null;

      return {
        data: { previousPost: pick(previousPost), nextPost: pick(nextPost) },
        cacheTags: ['site', 'post-list'],
      };
    }

    case 'Author': {
      const author =
        state.authors.find((candidate) => candidate.id === variables.id) ??
        null;

      return {
        data: {
          author: author
            ? { name: author.name, picture: author.picture }
            : null,
        },
        cacheTags: [
          'site',
          ...(author ? [`author:${author.id}`] : ['author-list']),
        ],
      };
    }

    default:
      throw new Error(`Unknown GraphQL operation: ${operationName}`);
  }
};

export type MockCdaServer = {
  url: string;
  close: () => Promise<void>;
};

export const startMockCdaServer = (port: number, expectedToken: string) =>
  new Promise<MockCdaServer>((resolve) => {
    let state = createInitialState();
    let requests: ReceivedRequest[] = [];

    const handleGraphQL = async (
      request: IncomingMessage,
      response: ServerResponse,
    ) => {
      const token =
        request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? null;

      if (token !== expectedToken) {
        return json(response, 401, {
          errors: [
            {
              message: 'Invalid API token',
              extensions: { code: 'INVALID_AUTHORIZATION_HEADER' },
            },
          ],
        });
      }

      const body = JSON.parse(await readBody(request)) as GraphQLRequest;
      const operationName =
        body.operationName ??
        body.query.match(/(?:query|mutation)\s+(\w+)/)?.[1] ??
        '';

      requests.push({ operationName, variables: body.variables ?? {}, token });

      try {
        const { data, cacheTags } = resolveOperation(state, {
          ...body,
          operationName,
        });

        const wantsCacheTags = request.headers['x-cache-tags'] === 'true';

        return json(
          response,
          200,
          { data },
          wantsCacheTags ? { 'X-Cache-Tags': cacheTags.join(' ') } : {},
        );
      } catch (error) {
        return json(response, 400, {
          errors: [{ message: (error as Error).message }],
        });
      }
    };

    const handleControl = async (
      pathname: string,
      request: IncomingMessage,
      response: ServerResponse,
    ) => {
      const body =
        request.method === 'GET'
          ? null
          : JSON.parse((await readBody(request)) || '{}');

      switch (`${request.method} ${pathname}`) {
        case 'GET /__control/state':
          return json(response, 200, state);

        case 'PUT /__control/state':
          state = body as ContentState;
          return json(response, 200, state);

        case 'POST /__control/reset':
          state = createInitialState();
          requests = [];
          return json(response, 200, { ok: true });

        case 'POST /__control/posts': {
          const { id, ...patch } = body as Partial<PostFixture> & {
            id: string;
          };
          state.posts = state.posts.map((post) =>
            post.id === id ? { ...post, ...patch } : post,
          );
          return json(
            response,
            200,
            state.posts.find((post) => post.id === id) ?? null,
          );
        }

        case 'POST /__control/authors': {
          const { id, ...patch } = body as Partial<AuthorFixture> & {
            id: string;
          };
          state.authors = state.authors.map((author) =>
            author.id === id ? { ...author, ...patch } : author,
          );
          return json(
            response,
            200,
            state.authors.find((author) => author.id === id) ?? null,
          );
        }

        case 'GET /__control/requests':
          return json(response, 200, requests);

        case 'DELETE /__control/requests':
          requests = [];
          return json(response, 200, { ok: true });

        default:
          return json(response, 404, {
            error: `Unknown control endpoint: ${pathname}`,
          });
      }
    };

    const server = createServer(async (request, response) => {
      const { pathname } = new URL(request.url ?? '/', 'http://localhost');

      try {
        if (pathname === '/graphql' && request.method === 'POST') {
          return await handleGraphQL(request, response);
        }

        if (pathname.startsWith('/__control/')) {
          return await handleControl(pathname, request, response);
        }

        if (pathname.startsWith('/images/')) {
          response.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-store',
          });
          return response.end(PLACEHOLDER_JPEG);
        }

        return json(response, 404, { error: 'Not found' });
      } catch (error) {
        return json(response, 500, { error: (error as Error).message });
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
