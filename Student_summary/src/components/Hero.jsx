import React from 'react';
import HeroText from './Hero/HeroText';
import HeroImage from './Hero/HeroImage';

const Hero = () => {
  return (
    <div className="bg-white">
      <div className="w-full max-w-[1200px] mx-auto px-8 pt-20 min-h-[550px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="text-right order-2 md:order-1 pl-32 relative left-15">
            <HeroText />
          </div>
          <div className="order-1 md:order-2 transform-gpu -mt-8">
            <HeroImage />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;