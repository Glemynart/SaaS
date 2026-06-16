'use client';

import * as React from 'react';
import { LandingNav } from './landing-nav';
import { HeroSection } from './hero-section';
import { SocialProofBar } from './social-proof-bar';
import { ProblemSection } from './problem-section';
import { FeaturesSection } from './features-section';
import { ColombiaSection } from './colombia-section';
import { HowItWorksSection } from './how-it-works-section';
import { ComparisonSection } from './comparison-section';
import { BenefitsSection } from './benefits-section';
import { RoadmapSection } from './roadmap-section';
import { FaqSection } from './faq-section';
import { FinalCtaSection } from './final-cta-section';
import { LandingFooter } from './landing-footer';
import { DemoSheet } from './demo-sheet';

export function LandingClient() {
  const [demoOpen, setDemoOpen] = React.useState(false);

  function openDemo() {
    setDemoOpen(true);
  }

  return (
    <>
      <LandingNav onDemoOpen={openDemo} />
      <main id="main-content">
        <HeroSection onDemoOpen={openDemo} />
        <SocialProofBar />
        <ProblemSection />
        <FeaturesSection onDemoOpen={openDemo} />
        <ColombiaSection />
        <HowItWorksSection onDemoOpen={openDemo} />
        <ComparisonSection onDemoOpen={openDemo} />
        <BenefitsSection />
        <RoadmapSection onDemoOpen={openDemo} />
        <FaqSection />
        <FinalCtaSection onDemoOpen={openDemo} />
      </main>
      <LandingFooter />
      <DemoSheet open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}
