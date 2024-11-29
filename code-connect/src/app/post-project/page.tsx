import React from 'react'
import NavBar from '../Components/NavBar'
import "./style.css"

const page = () => {
  return (
    <div className='w-screen h-screen radial-background flex flex-col items-center'>
      <NavBar />
      <h1>Project Name</h1>
      <div className='bento-container w-full'>
        <div className='bento-box full-width radial-background'>Full Width Box 1</div>
        <div className='bento-box half-width radial-background'>Half Width Box 1</div>
        <div className='bento-box half-width radial-background'>Half Width Box 2</div>
        <div className='bento-box half-width radial-background'>Half Width Box 3</div>
        <div className='bento-box half-width radial-background'>Half Width Box 4</div>
        <div className='bento-box full-width radial-background'>Full Width Box 2</div>
      </div>
    </div>
  )
}

export default page