import { XmlViewer } from "@/components/XmlViewer";
import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/nav";
export default function Home() {
    return (
        <div className="">
            <Nav sticky={false} />
            <XmlViewer />
        </div>
    );
}
