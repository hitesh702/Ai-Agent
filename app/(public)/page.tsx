import HeroSection from "@/component/HeroSection";
import HowItWorks from "@/component/HowItWorks";
import IndustriesSection from "@/component/IndustriesSection";
import FeaturesSection from "@/component/FeaturesSection";
import CoachingSection from "@/component/CoachingSection";
import DashboardPreview from "@/component/DashboardPreview";
import PricingSection from "@/component/PricingSection";
import FAQSection from "@/component/FAQSection";
import FinalCTA from "@/component/FinalCTA";
import Footer from "@/component/Footer";

import "../landing.css";

export default function Home() {
  return (
    <main className="landing">
      <HeroSection />

      <HowItWorks />

      <IndustriesSection />

      <FeaturesSection />

      <CoachingSection />

      <DashboardPreview />

      <PricingSection />

      <FAQSection />

      <FinalCTA />

      <Footer />

    </main>
  );
}