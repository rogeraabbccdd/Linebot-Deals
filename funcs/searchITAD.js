const axios = require('axios')

module.exports = async (name, itadShops) => {
  const query = encodeURIComponent(name.trim())
  let result = []

  try {
    const { data } = await axios.get(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${query}&offset=&limit=200&region=us&country=US&shops=${itadShops}`)
    result = data.data.list
  } catch (error) {
    console.log('Search Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
