import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavProps {
  sticky?: boolean;
}

export default function Nav({ sticky = true }: NavProps) {
    return (
        <nav className={cn(
          "w-full bg-slate-950/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50",
          sticky ? "fixed top-0" : "relative"
        )}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/logo-white.png"
              alt="StigBee Logo"
              width={48}
              height={48}
              className="object-contain rounded-lg transition-transform group-hover:scale-105"
            />
            <h1 className="text-3xl font-bold text-white">
              Stig<span className="text-amber-500">Bee</span>
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/checklist-editor" className="hover:cursor-pointer">
              <Button variant="ghost" className="text-white hover:bg-slate-900 hover:text-white hover:cursor-pointer">
                Editor
              </Button>
            </Link>
            <ThemeToggle />
            <a href="https://github.com/softservesoftware/stig-bee" target="_blank" rel="noopener noreferrer" className="hover:cursor-pointer">
              <Button variant="ghost" className="text-white hover:bg-slate-900 hover:text-white hover:cursor-pointer">
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </a>
          </div>
        </div>
      </nav>
    )
}