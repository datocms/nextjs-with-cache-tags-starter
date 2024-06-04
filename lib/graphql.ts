import type { introspection } from './graphql-env.d.ts';
import { initGraphQLTada } from 'gql.tada';

export const graphql = initGraphQLTada<{
	introspection: introspection;
	scalars: {
		BooleanType: boolean;
		CustomData: Record<string, string>;
		Date: string;
		DateTime: string;
		FloatType: number;
		IntType: number;
		ItemId: string;
		JsonField: unknown;
		MetaTagAttributes: Record<string, string>;
		UploadId: string;
	};
}>();

export { readFragment } from 'gql.tada';

export type {
	FragmentOf,
	ResultOf,
	VariablesOf,
} from 'gql.tada';
