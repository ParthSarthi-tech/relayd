"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DASHBOARD_URL } from "@/lib/config";

export function PricingSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pricing" ref={sectionRef} className="relative py-32 lg:py-40 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div
          className={`text-center max-w-3xl mx-auto transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            Pricing
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-8">
            Self-hosted.
            <br />
            <span className="text-stroke">Free to use.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Relay is open-source and self-hosted. Run it on your own infrastructure 
            with Docker, connect it to your own Postgres and Redis instances — 
            no licenses, no per-webhook fees, no vendor lock-in.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={`${DASHBOARD_URL}/register`}>
              <button className="bg-foreground text-background px-8 h-14 text-base rounded-full flex items-center gap-2 hover:opacity-90 transition-all group font-medium">
                Get started
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </a>
            <a href={`${DASHBOARD_URL}/login`}>
              <button className="border border-foreground/20 text-foreground px-8 h-14 text-base rounded-full hover:bg-foreground/5 transition-all font-medium">
                Sign in
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
