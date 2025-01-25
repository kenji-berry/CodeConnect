import React from 'react'
import Logo from './Logo'
import Link from 'next/link'
import LoginButton from './LoginButton'

const NavBar = () => {
    return (
      <nav className='w-full bg-transparent flex justify-between px-3 pt-3'>
        <div className='flex'>
          <Link href="/">
            <Logo rem={2.5}/>
          </Link>
          <ul className='flex gap-5 ml-6 inria-sans-bold mt-1 text-sm'>
            <li>
              <Link href="/contributions" className='text-off-white hover:text-orange transition-colors cursor-pointer'>
                Your Contributions
              </Link>
            </li>
            <li>
              <Link href="/post-project" className='text-off-white hover:text-orange transition-colors cursor-pointer'>
                Post A Project
              </Link>
            </li>
            <li>
              <Link href="/about" className='text-off-white hover:text-orange transition-colors cursor-pointer'>
                About Us
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <LoginButton/>
        </div>
      </nav>
    )
}

export default NavBar