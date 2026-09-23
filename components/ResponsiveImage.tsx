import { ResponsiveImage } from '@/fragments/responsive-image';
import { type FragmentOf, readFragment } from '@/lib/graphql';
import { SRCImage } from 'react-datocms';

type Props = {
  responsiveImage: FragmentOf<typeof ResponsiveImage>;
};

/**
 * `SRCImage` ships zero client-side JS. The client-side `Image` would pull the
 * whole `react-datocms` bundle (including the optional Mux player) into the
 * client build.
 */
export default function ContentImage({ responsiveImage }: Props) {
  const fragment = readFragment(ResponsiveImage, responsiveImage);

  return <SRCImage data={fragment} />;
}
