import { XmlViewer } from "@/components/XmlViewer";
import Nav from "@/components/nav";
export default function Home() {
    return (
        <div className="">
            <Nav sticky={false} />
            <XmlViewer />
        </div>
    );
}
