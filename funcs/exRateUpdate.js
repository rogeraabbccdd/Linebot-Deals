const axios = require('axios')

module.exports = async () => {
  let result = 30

  try {
    const { data } = await axios.get('https://tw.rter.info/capi.php')
    result = Math.round(data.USDTWD.Exrate * 100) / 100
  } catch (error) {
    console.log('exRateUpdate Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
