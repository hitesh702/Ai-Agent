import Navbar from "./component/Navbar";
import Hero from "./component/Hero";
import HowItWorks from "./component/HowItWorks";
import Services from "./component/Services";
import Pricing from "./component/Pricing";
import Footer from "./component/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Services />
      <Pricing />
      <Footer />
    </>
  );
}