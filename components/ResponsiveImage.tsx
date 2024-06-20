import { ResponsiveImage } from '@/fragments/responsive-image';
import { type FragmentOf, readFragment } from '@/lib/graphql';
import { Image as DatoImage } from 'react-datocms';

type Props = {
  responsiveImage: FragmentOf<typeof ResponsiveImage>;
};

export default function ContentImage({ responsiveImage }: Props) {
  const fragment = readFragment(ResponsiveImage, responsiveImage);

  return <DatoImage data={fragment} />;
}
