import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { ArrowRight, Github, Terminal, Shield, Layers, Users, Database, RefreshCw, ShieldCheck, Plus } from "lucide-react";
import Nav from "@/components/nav";
export default function Home() {
  return (
    <main className="w-full min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <Nav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-8">
          <Badge className="px-4 py-1 text-sm bg-slate-900 text-white border border-slate-800">
            Open Source • 100% Local • Cross-Platform
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="text-white">Take the </span>
            <span className="text-amber-500">Sting</span>
            <span className="text-white"> Out of STIGs</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
            A modern, web first, and open-source STIG checklist viewer that you can run locally or in the cloud.
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
                <CardTitle className="text-xl text-white">Mac, Windows, and Linux</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Run seamlessly on any system with Docker (Mac, Linux, and Windows) or our 100% local web application.</p>
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

      {/* Premium Features Section */}
      <section className="py-20 px-4 md:px-8 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          <span className="text-amber-500">Premium </span>
            <span className="text-white">Features </span>
            
          </h2>
          <p className="text-xl text-slate-400 text-center mb-16 max-w-3xl mx-auto">
            Take your STIG management to the next level with our premium features
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Layers className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">Jira Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Automatically create Jira tickets for findings, streamlining your remediation workflow and keeping track of progress.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">Real-time Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Work together seamlessly with real-time updates. No more passing files back and forth - collaborate in real-time.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">Centralized Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Store and manage all your STIG checklists in one secure, centralized location with version control.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <RefreshCw className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">Automatic STIG Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Stay current with automatic updates for newly released STIG versions and eMASS integration.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">eMASS Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Automated eMASS updating and synchronization to keep your compliance records up to date.</p>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-lg transition-all duration-300 bg-slate-950 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl text-white">And More</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Stay tuned for additional premium features designed to enhance your STIG management workflow.</p>
              </CardContent>
            </Card>
          </div>
          {/* contact us mailto:matt@softservsoftware.com */}
          <p className="text-slate-400 text-center text-lg my-4">
            <a href="mailto:matt@softservsoftware.com" className="text-amber-500 hover:underline">Contact us</a> to learn more about our premium features
          </p>
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
              src="/logo-white.png"
              alt="StigBee Logo"
              width={24}
              height={24}
              className="object-contain rounded-lg"
            />
            <span className="text-lg font-semibold text-white">Stig<span className="text-amber-500">Bee</span></span>
          </div>

          <p className="text-sm text-slate-400 text-center max-w-3xl mx-auto">
            StigBee is not affiliated with the US Government. 
            The hosted web application is not accredited by the US Government. 
            The hosted web application does not store any user uploaded data, all operations are executed in browser. 
            This is an open source project, application security is encouraged to be verified by the community in the public GitHub repository.
          </p>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Softserve Software LLC. All rights reserved.
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
