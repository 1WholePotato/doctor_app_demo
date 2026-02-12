function Hero() {
    return (
        <section className="h-screen flex items-center justify-center bg-blue-50 pt-20">
            <div className="text-center max-w-2x1">
                <h1 className="text-3xl font-bold mb-6">
                    Medical Class Website Demo
                </h1>
                <p className="text-lg text-grey-600 mb-6">
                    Slogan Here or something can also remove 
                </p>
                <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
                    Make a Booking!
                </button>
            </div>
        </section>
    )
}

export default Hero