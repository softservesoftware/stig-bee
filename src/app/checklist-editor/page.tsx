import { XmlViewer } from "@/components/XmlViewer";
import Link from "next/link";
import Image from "next/image";
export default function Home() {
    return (
        <>
            <div className="flex items-center gap-2 m-4">
                <Link href="/" className="hover:cursor-pointer flex items-center gap-2">
                    <Image
                        src="/stigbee-minimal.png"
                        alt="StigBee Logo"
                        width={40}
                        height={40}
                        className="object-contain rounded-lg"
                    />
                    <h1 className="text-4xl font-bold uppercase">Stigbee</h1>
                </Link>

            </div>
            <XmlViewer />
        </>
    );
}
