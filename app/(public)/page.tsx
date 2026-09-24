import Navbar from "@/component/Navbar";
import HeroSection from "@/component/HeroSection";
import HowItWorks from "@/component/HowItWorks";
import IndustriesSection from "@/component/IndustriesSection";


import "../landing.css";

export default function Home() {
  return (
    <>

      <main className="landing">
        <HeroSection />
            <HowItWorks />
            <IndustriesSection />
      </main>
    </>
  );
}
