import { SRCImage } from 'react-datocms';
import { ResponsiveImage } from '@/fragments/responsive-image';
import { type FragmentOf, readFragment } from '@/lib/graphql';

type Props = {
  responsiveImage: FragmentOf<typeof ResponsiveImage>;
};

/**
 * Renders a DatoCMS `responsiveImage` as a plain `<picture>` element.
 * `SRCImage` ships zero client-side JS, so it can be used directly from Server
 * Components.
 */
export default function ContentImage({ responsiveImage }: Props) {
  const fragment = readFragment(ResponsiveImage, responsiveImage);

  return <SRCImage data={fragment} />;
}
