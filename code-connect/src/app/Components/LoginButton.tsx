import React from 'react'

const LoginButton = () => {
  return (
    <button 
      className="bg-[--muted-red] hover: px-3 py-2 rounded-full transition-colors duration-200 inria-sans-bold text-off-white text-sm"
    >
      Log in with GitHub
    </button>
  )
}

export default LoginButton