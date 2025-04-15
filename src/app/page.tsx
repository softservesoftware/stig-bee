import { XmlViewer } from "@/components/XmlViewer";

export default function Home() {
  return (
    <main className="w-full min-h-screen">
      <h1 className="text-4xl font-bold py-6 text-center">XML Viewer</h1>
      <XmlViewer />
    </main>
  );
}
