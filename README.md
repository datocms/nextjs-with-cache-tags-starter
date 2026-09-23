<!--datocms-autoinclude-header start-->

<a href="https://www.datocms.com/"><img src="https://www.datocms.com/images/full_logo.svg" height="60"></a>

👉 [Visit the DatoCMS homepage](https://www.datocms.com) or see [What is DatoCMS?](#what-is-datocms)

---

<!--datocms-autoinclude-header end-->

# Next.js + DatoCMS Cache Tags

Everything you need to know to build a Next.js project powered by DatoCMS Cache Tags to achieve the perfect balance of performance, efficiency, and real-time updates.

<img src="https://github.com/datocms/nextjs-with-cache-tags-starter/raw/main/images/browser.png" />

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Getting Started](#getting-started)
  - [Step 1: Clone the DatoCMS project](#step-1-clone-the-datocms-project)
  - [Step 2: Environment variables](#step-2-environment-variables)
      - [`PUBLIC_DATOCMS_API_TOKEN`](#public_datocms_api_token)
      - [`WEBHOOK_TOKEN`](#webhook_token)
      - [`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`](#turso_database_url-turso_auth_token)
  - [Step 3: Install dependencies and download the DatoCMS GraphQL Schema](#step-3-install-dependencies-and-download-the-datocms-graphql-schema)
  - [Step 4: Run development server](#step-4-run-development-server)
- [Deployment](#deployment)
- [Useful resources to navigate the code](#useful-resources-to-navigate-the-code)
  - [Execution of GraphQL queries](#execution-of-graphql-queries)
  - ["Cache Tags Invalidation" webhook](#cache-tags-invalidation-webhook)

## Getting Started

### Step 1: Clone the DatoCMS project

Start by pressing this button to create a new project on DatoCMS containing the data expected by this project:

[![Clone DatoCMS project](https://dashboard.datocms.com/clone/button.svg)](https://dashboard.datocms.com/clone?projectId=23796&name=Next.js+%2B+Cache+Tags)

### Step 2: Environment variables

Use `.env.local.example` file as a starting point:

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and start populating the variables:

##### `PUBLIC_DATOCMS_API_TOKEN`

The "GraphQL API Token" from the DatoCMS project you just created. [Learn to find/create an API token](https://www.datocms.com/docs/content-delivery-api/authentication).

##### `WEBHOOK_TOKEN`

Any secure random string. It will be used to authenticate the webhook requests that come from DatoCMS.

##### `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

Simply click the following button to create and initialize a Turso database with the expected schema (sign up or log in to Turso is required):

[![Create a database with Turso](https://sqlite.new/button)](https://sqlite.new?dump=https%3A//raw.githubusercontent.com/datocms/nextjs-with-cache-tags-starter/main/schema.sql)

Copy the database URL and use it to fill the `TURSO_DATABASE_URL` environment variable.

Also create a token for the database, with no expiration and read/write permissions: copy and use it for the `TURSO_AUTH_TOKEN` variable.

We selected Turso because it's an incredibly cost-effective solution and is compatible with any hosting service. However, any other storage solution would be just as effective due to the simplicity of the saved data.

### Step 3: Install dependencies and download the DatoCMS GraphQL Schema

Simply run `npm install` (or the equivalent command for your package manager of choice): a `schema.graphql` will be generated.

### Step 4: Run development server

Now you can run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

The project runs smoothly on both Vercel and Netlify. Just ensure to set the environment variables as previously explained. For your convenience, you can deploy the project on Vercel using this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdatocms%2Fnextjs-with-cache-tags-starter&env=PUBLIC_DATOCMS_API_TOKEN,WEBHOOK_TOKEN,TURSO_DATABASE_URL,TURSO_AUTH_TOKEN&envDescription=Please%20fill%20in%20the%20following%20information&envLink=https%3A%2F%2Fgithub.com%2Fdatocms%2Fnextjs-with-cache-tags-starter%3Ftab%3Dreadme-ov-file%23step-2-environment-variables)

**Important:** Once the site is deployed and you know the final domain, you need to set up a ["Invalidate cache tag" webhook](https://www.datocms.com/docs/content-delivery-api/cache-tags#step-3-implement-the-invalidate-cache-tag-webhook) on your DatoCMS project, configured like this:

* URL: https://`<YOUR-DOMAIN>`/api/invalidate-cache-tags
* Custom headers: `Webhook-Token: <YOUR_WEBHOOK_TOKEN>`
* Trigger:
  * Entity: Content Delivery API Cache Tags
  * Events: Invalidate

<img src="https://github.com/datocms/nextjs-with-cache-tags-starter/raw/main/images/webhook.png" width="500" />

## Useful resources to navigate the code

This repository aims to demonstrate how you can selectively invalidate the Next.js cache when receiving DatoCMS Cache Tags invalidation events. Before exploring this repository, it's very useful to understand the general concepts behind Cache Tags:

- DatoCMS Cache Tags: [Announcement](https://www.datocms.com/blog/introducing-datocms-cache-tags), [Documentation](https://www.datocms.com/docs/content-delivery-api/cache-tags)
- Cache Tags with Next.js: [Guide](https://www.datocms.com/docs/next-js/using-cache-tags)

The code essentially consists of two parts that are strongly interdependent:

### Execution of GraphQL queries

The [`executeQuery()` function](https://github.com/datocms/nextjs-with-cache-tags-starter/blob/main/lib/fetch-content.ts#L20) is responsible for executing a GraphQL query using the DatoCMS Content Delivery API and caching the result. To support cache invalidation, the request is tagged with a unique identifier in the Next.js Data Cache.

The mapping between the unique identifier of the query, and the DatoCMS Cache Tags returned in the response is stored in Turso. We use a [simple table](https://github.com/datocms/nextjs-with-cache-tags-starter/blob/main/schema.sql) made up of just two columns:

* `query_id` (TEXT): A unique identifier for the query, used to tag the request;
* `cache_tag` (TEXT): The actual cache tag returned by the query.

You can switch the storage option from Turso to other options by adjusting the code in [`lib/database.ts`](https://github.com/datocms/nextjs-with-cache-tags-starter/blob/main/lib/database.ts).

### "Cache Tags Invalidation" webhook

The [route handler `/api/invalidate-cache-tags`](https://github.com/datocms/nextjs-with-cache-tags-starter/blob/main/app/api/invalidate-cache-tags/route.ts) receives ["Cache Tag Invalidation" events from a DatoCMS webhook](https://www.datocms.com/docs/content-delivery-api/cache-tags#step-3-implement-the-invalidate-cache-tag-webhook) and is responsible for invalidating every cached GraphQL query that is linked to those tags.

Since the `executeQuery()`:

- Tags each GraphQL request with a unique ID in the Next.js Data Cache, and
- Saves the "Query ID <-> Cache Tags" mapping on a Turso database...

The endpoint can find in the database the query IDs associated with the received tags, and use `revalidateTag()` to invalidate the relevant requests.

<!--datocms-autoinclude-footer start-->

---

# What is DatoCMS?

<a href="https://www.datocms.com/"><img src="https://www.datocms.com/images/full_logo.svg" height="60" alt="DatoCMS - The Headless CMS for the Modern Web"></a>

[DatoCMS](https://www.datocms.com/) is the REST & GraphQL Headless CMS for the modern web.

Trusted by over 25,000 enterprise businesses, agencies, and individuals across the world, DatoCMS users create online content at scale from a central hub and distribute it via API. We ❤️ our [developers](https://www.datocms.com/team/best-cms-for-developers), [content editors](https://www.datocms.com/team/content-creators) and [marketers](https://www.datocms.com/team/cms-digital-marketing)!

**Why DatoCMS?**

- **API-First Architecture**: Built for both REST and GraphQL, enabling flexible content delivery
- **Just Enough Features**: We believe in keeping things simple, and giving you [the right feature-set tools](https://www.datocms.com/features) to get the job done
- **Developer Experience**: First-class TypeScript support with powerful developer tools

**Getting Started:**

- ⚡️ [Create Free Account](https://dashboard.datocms.com/signup) - Get started with DatoCMS in minutes
- 🔖 [Documentation](https://www.datocms.com/docs) - Comprehensive guides and API references
- ⚙️ [Community Support](https://community.datocms.com/) - Get help from our team and community
- 🆕 [Changelog](https://www.datocms.com/product-updates) - Latest features and improvements

**Official Libraries:**

- [**Content Delivery Client**](https://github.com/datocms/cda-client) - TypeScript GraphQL client for content fetching
- [**REST API Clients**](https://github.com/datocms/js-rest-api-clients) - Node.js/Browser clients for content management
- [**CLI Tools**](https://github.com/datocms/cli) - Command-line utilities for schema migrations (includes [Contentful](https://github.com/datocms/cli/tree/main/packages/cli-plugin-contentful) and [WordPress](https://github.com/datocms/cli/tree/main/packages/cli-plugin-wordpress) importers)

**Official Framework Integrations**

Helpers to manage SEO, images, video and Structured Text coming from your DatoCMS projects:

- [**React Components**](https://github.com/datocms/react-datocms)
- [**Vue Components**](https://github.com/datocms/vue-datocms)
- [**Svelte Components**](https://github.com/datocms/datocms-svelte)
- [**Astro Components**](https://github.com/datocms/astro-datocms)

**Additional Resources:**

- [**Plugin Examples**](https://github.com/datocms/plugins) - Example plugins we've made that extend the editor/admin dashboard
- [**Starter Projects**](https://www.datocms.com/marketplace/starters) - Example website implementations for popular frameworks
- [**All Public Repositories**](https://github.com/orgs/datocms/repositories?q=&type=public&language=&sort=stargazers)

<!--datocms-autoinclude-footer end-->
