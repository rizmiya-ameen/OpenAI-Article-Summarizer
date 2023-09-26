
const Hero = () => {
  return (
    <header className='w-full flex justify-center items-center flex-col'>

      <nav className='w-full flex justify-center items-center flex-row mb-10 pt-3'>
        
        <p className='mt-10 text-[30px] font-croissant text-transparent bg-gradient-to-r from-green-600 via-blue-600 to-teal-600 bg-clip-text'>Insightify</p>

      </nav>

      <h1 className='head_text'>Summarize Articles with <br /> <span className='blue_gradient'>OpenAI GPT-4</span></h1>

      <h2 className='desc'>Simplify your reading with Insightify, an open-source article summarizer that transforms lengthy articles into clear and concise summaries</h2>

    </header>
  )
}

export default Hero