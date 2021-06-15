module.exports = (data, plain) => {
  const steam = data.filter((item) => item.plain === plain && item.shop.id === 'steam')
  if (steam.length > 0) {
    const steamUrl = steam[0].urls.buy
    const info = steamUrl.match(/\/(app|sub|bundle|friendsthatplay|gamecards|recommended)\/([0-9]{1,7})/)
    return info ? { id: parseInt(info[2], 10), type: info[1] } : { id: -1, type: 'null' }
  }
  return { id: -1, type: 'null' }
}
