
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { ArrowRight, Github, Terminal, Shield,  } from "lucide-react";

export default function Home() {
  return (
    <main className="w-full min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/stigbee-minimal.png"
              alt="StigBee Logo"
              width={32}
              height={32}
              className="object-contain rounded-lg transition-transform group-hover:scale-105"
            />
            <h1 className="text-2xl font-bold text-white">
              Stig<span className="text-amber-500">Bee</span>
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/checklist-editor">
              <Button variant="ghost" className="text-white hover:bg-slate-900">
                Editor
              </Button>
            </Link>
            <a href="https://github.com/softservesoftware/stig-bee" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="text-white hover:bg-slate-900">
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-8">
          <Badge className="px-4 py-1 text-sm bg-slate-900 text-white border border-slate-800">
            Open Source • 100% Local • Cross-Platform
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="text-white">We Take the </span>
            <span className="text-amber-500">Sting</span>
            <span className="text-white"> Out of Doing STIGs</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
            A modern, open-source STIG checklist tool that transforms your security compliance workflow.
          </p>
        </div>
      </section>
      {/* Get Started Section */}
      <section className="px-4 md:px-8 bg-slate-950 pb-12">
      <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            <span className="text-white">Get Started in </span>
            <span className="text-amber-500">Seconds</span>
          </h2>
          
          <div className="max-w-3xl mx-auto mb-4">
            <div className="bg-slate-900 text-slate-100 p-6 rounded-lg font-mono text-sm overflow-x-auto">
              <p className="text-amber-500">$ docker run -p 3000:3000 ghcr.io/softservesoftware/stig-bee:latest</p>
            </div>
            <p className="mt-4 text-sm text-slate-400 text-center">
              Then open <a href="http://localhost:3000" className="text-amber-500 hover:underline">http://localhost:3000</a> in your browser
            </p>
            <p className="text-slate-400 text-center text-sm my-4">
              Or 
            </p>
            <Link href="/checklist-editor" className="w-full flex justify-center items-center">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white px-8 h-12 text-lg">
                Launch Web Editor <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 md:px-8 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            <span className="text-white">Why Choose </span>
            <span className="text-amber-500">StigBee</span>
            <span className="text-white">?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">100% Local</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Your data stays on your machine. No server communication, ensuring maximum security and privacy.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Terminal className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">Cross-Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Run seamlessly on any system with Docker support for both Mac and Windows environments.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Github className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">Open Source</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Fully transparent codebase. Join our community and help shape the future of STIG management.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-8 bg-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-white">Ready to Transform Your </span>
            <span className="text-amber-500">STIG Reviews</span>
            <span className="text-white">?</span>
          </h2>
          <p className="text-xl mb-8 text-slate-400">
            Join the growing community of security professionals who have simplified their compliance workflow.
          </p>
          <Link href="/checklist-editor">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white px-8 h-12 text-lg">
              Launch Web Editor <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image
              src="/stigbee-minimal.png"
              alt="StigBee Logo"
              width={24}
              height={24}
              className="object-contain rounded-lg"
            />
            <span className="text-lg font-semibold text-white">Stig<span className="text-amber-500">Bee</span></span>
          </div>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} StigBee. All rights reserved.
          </p>
          <div className="mt-4">
            <a 
              href="https://github.com/softservesoftware/stig-bee" 
              className="text-amber-500 hover:text-amber-600 inline-flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
