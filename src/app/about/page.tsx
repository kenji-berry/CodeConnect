import React from 'react';
import CodeConnectTitle from '../Components/CodeConnectTitle';

const page = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-10 bg-[#18181b]">
      <div className="w-full max-w-[1000px] mx-auto flex flex-col flex-grow">
        <div className="mb-10 flex justify-center">
          <CodeConnectTitle />
        </div>

        <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 flex flex-col gap-6 flex-grow">
          <h1 className='text-4xl font-bold text-[var(--off-white)] mb-2'>About CodeConnect</h1>

          <p className="text-lg text-gray-300 leading-relaxed">
            CodeConnect is a platform designed to make discovering and contributing to open source projects easier and more personalised. Whether you&apos;re a beginner looking for your first issue or a seasoned developer browsing by tech stack or topic, CodeConnect helps you find projects that match your interests, experience, and goals.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed">
            Built with a focus on simplicity and accessibility, it offers real-time project insights, filters based on difficulty, communication style, and tech stack, and supports maintainers with tools to highlight the kind of help they need most.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed">
            The platform also features weekly or daily email recommendations and lightweight onboarding to help contributors get started quickly.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed pt-4 border-t border-gray-700">
            We are always looking to improve! If you have any suggestions for new tags, technologies, features, or any other improvements you think we can make to our platform, please contact us at <a href="mailto:codeconnectcc@gmail.com" className="text-[var(--title-red)] hover:underline">codeconnectcc@gmail.com</a>.
          </p>
        </section>

        <footer className="mt-8 text-center text-gray-500 text-sm pb-4">
          Developed by <a href="https://github.com/kenji-berry" target="_blank" rel="noopener noreferrer" className="text-[var(--muted-red)] hover:underline">Kenji</a>
        </footer>
      </div>
    </div>
  );
};

export default page;