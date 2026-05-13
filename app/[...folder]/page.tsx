import FileBrowser from '@/components/FileBrowser';

interface Props {
  params: Promise<{ folder: string[] }>;
}

export default async function FolderPage({ params }: Props) {
  const { folder } = await params;
  const folderPath = folder ? folder.join('/') : '';
  return <FileBrowser folder={folderPath} />;
}
