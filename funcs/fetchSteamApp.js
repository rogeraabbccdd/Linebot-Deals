const axios = require('axios')

module.exports = async (id) => {
  let result = {}

  try {
    const { data } = await axios.get(`http://store.steampowered.com/api/appdetails/?appids=${id}&cc=tw&filters=price_overview`)
    result = data
  } catch (error) {
    console.log('Fetch Steam App Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
