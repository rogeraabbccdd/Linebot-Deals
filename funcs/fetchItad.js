const axios = require('axios')

module.exports = async (plain, itadShops) => {
  try {
    let fetch1 = axios.get(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
    let fetch2 = axios.get(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
    let fetch3 = axios.get(`https://api.isthereanydeal.com/v01/game/bundles/?key=${process.env.ITAD_KEY}&plains=${plain}&expired=0`)
    fetch1 = await fetch1
    fetch2 = await fetch2
    fetch3 = await fetch3
    return [fetch1.data, fetch2.data, fetch3.data]
  } catch (error) {
    console.log('Fetch ITAD Error')
    if (process.env.ERROR === 'true') console.log(error)
  }
}
