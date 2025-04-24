import React from 'react'
import CodeConnectTitle from '../Components/CodeConnectTitle'

const page = () => {
  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <CodeConnectTitle />
      <div className='w-3/4'>
        <h1 className='text-3xl mb-4'>About Code Connect</h1>
        <p className="mb-4">
          CodeConnect is a platform designed to make discovering and contributing to open source projects easier and more personalised. Whether you&apos;re a beginner looking for your first issue or a seasoned developer browsing by tech stack or topic, CodeConnect helps you find projects that match your interests, experience, and goals.
        </p>
        <p className="mb-4">
          Built with a focus on simplicity and accessibility, it offers real-time project insights, filters based on difficulty, communication style, and tech stack, and supports maintainers with tools to highlight the kind of help they need most.
        </p>
        <p>
          The platform also features weekly or daily email recommendations and lightweight onboarding to help contributors get started quickly.
        </p>
      </div>

      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  )
}

export default page