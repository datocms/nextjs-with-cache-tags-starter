import { ResponsiveImage } from '@/fragments/responsive-image';
import { type FragmentOf, readFragment } from '@/lib/graphql';
import { SRCImage } from 'react-datocms';

type Props = {
  responsiveImage: FragmentOf<typeof ResponsiveImage>;
};

export default function ContentImage({ responsiveImage }: Props) {
  const fragment = readFragment(ResponsiveImage, responsiveImage);

  return <SRCImage data={fragment} />;
}
