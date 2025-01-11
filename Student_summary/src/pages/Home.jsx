import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import ComparisonTable from '../components/ComparisonTable';
import StudentStories from '../components/StudentStories';
import Footer from '../components/Footer';
import ThenVsToday from '../components/ThenVsToday';

const Home = () => {
  return (
    <div>
      <div className="bg-white">
        <Hero />
      </div>
      <Features />
      <HowItWorks />
      <ComparisonTable />
      <ThenVsToday />
      <StudentStories />
      <Footer />
    </div>
  );
};

export default Home; 