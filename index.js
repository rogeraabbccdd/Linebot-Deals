require('dotenv').config()
const linebot = require('linebot')
const rp = require('request-promise')
const schedule = require('node-schedule')
const cloudscraper = require('cloudscraper')

const bot = linebot({
  channelId: process.env.CHANNEL_ID,
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
})

const formatDate = (date) => {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

const getItadPlainByName = (json, name) => json.data.list.filter((list) => list.title.trim().toUpperCase() === name.trim().toUpperCase())

const getSteamInfoByPlain = (json, plain) => {
  const steam = json.data.list.filter((list) => list.plain === plain && list.shop.id === 'steam')
  if (steam.length > 0) {
    const steamUrl = steam[0].urls.buy
    const info = steamUrl.match(/\/(app|sub|bundle|friendsthatplay|gamecards|recommended)\/([0-9]{1,7})/)
    return info ? { id: parseInt(info[2], 10), type: info[1] } : { id: -1, type: 'null' }
  }
  return { id: -1, type: 'null' }
}

const itadShops = 'amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore'

let exRateUSDTW = 30

const exRateUpdate = () => {
  rp('https://tw.rter.info/capi.php').then((res) => {
    exRateUSDTW = Math.round(JSON.parse(res).USDTWD.Exrate * 100) / 100
  })
}

exRateUpdate()

schedule.scheduleJob('* * 0 * * *', () => {
  exRateUpdate()
})

const getItadData = async (name) => {
  const reply = []
  let replyText = ''
  try {
    const query = encodeURIComponent(name.trim())
    let htmlString = ''

    /* search game */
    htmlString = await rp(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${query}&offset=&limit=&region=us&country=US&shops=${itadShops}`)
    const searchJson = JSON.parse(htmlString)
    const find = getItadPlainByName(searchJson, name)
    if (find.length === 0) {
      if (searchJson.data.list.length === 0) reply.push({ type: 'text', text: '找不到符合的遊戲' })
      else {
        let suggestions = ''
        searchJson.data.list.sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))
        suggestions = '找不到符合的遊戲，你是不是要找...\n'

        // j = array index
        let j = 0
        // i = max 5 suggestions
        for (let i = 0; i < 5; i++) {
          if (searchJson.data.list[j]) {
            if ((j === 0) || (j > 0 && !reply.includes(searchJson.data.list[j].title))) {
              suggestions += `- ${searchJson.data.list[j].title}\n`
            } else i--
          } else break
          j++
        }

        reply.push({ type: 'text', text: suggestions })
      }
    } else {
      const { plain } = find[0]
      const appTitle = find[0].title
      const appInfo = getSteamInfoByPlain(searchJson, plain)

      htmlString = await rp(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
      const lowest = JSON.parse(htmlString).data[plain]
      htmlString = await rp(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
      const current = JSON.parse(htmlString).data[plain].list[0]

      const rDeal = `${appTitle}\n` +
        '.\n' +
        'IsThereAnyDeal:\n' +
        `原價: ${current.price_old} USD / ${Math.round(current.price_old * exRateUSDTW * 100) / 100} TWD\n` +
        `目前最低: ${current.price_new} USD / ${Math.round(current.price_new * exRateUSDTW * 100) / 100} TWD, -${current.price_cut}%, 在 ${current.shop.name}\n` +
        `歷史最低: ${lowest.price} USD / ${Math.round(lowest.price * exRateUSDTW * 100) / 100} TWD, -${lowest.cut}%, ${formatDate(new Date(lowest.added * 1000))} 在 ${lowest.shop.name}\n` +
        `${current.url}\n`

      let rInfo = '.\n' +
        '更多資訊:\n' +
        `https://isthereanydeal.com/game/${plain}/info/\n`

      htmlString = await rp(`https://api.isthereanydeal.com/v01/game/bundles/?key=${process.env.ITAD_KEY}&plains=${plain}&expired=0`)
      const bundle = JSON.parse(htmlString).data[plain]

      let rBundle = '.\n' +
        '入包資訊:\n' +
        `總入包次數: ${bundle.total}\n` +
        '目前入包:\n'

      for (const b of bundle.list) {
        rBundle += `${b.title}, ~${formatDate(new Date(b.expiry * 1000))}\n${b.url}`
      }

      replyText += rDeal + rBundle

      /* is steam */
      if (appInfo.id !== -1) {
        let rSteam = '.\nSteam:\n'
        rInfo += `https://store.steampowered.com/${appInfo.type}/${appInfo.id}/\n` +
          `https://steamdb.info/${appInfo.type}/${appInfo.id}/`

        if (appInfo.type === 'app') {
          reply.push({
            type: 'image',
            originalContentUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`,
            previewImageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`
          })

          htmlString = await rp(`http://store.steampowered.com/api/appdetails/?appids=${appInfo.id}&cc=tw&filters=price_overview`)
          const steamOV = JSON.parse(htmlString)

          if (steamOV[appInfo.id].success && typeof steamOV[appInfo.id].data === 'object') {
            const price = steamOV[appInfo.id].data.price_overview
            rSteam += `原價: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%\n`

            htmlString = await cloudscraper(`https://steamdb.info/api/ExtensionGetPrice/?appid=${appInfo.id}&currency=TWD`)
            const steamLow = JSON.parse(htmlString)
            if (steamLow.success) rSteam += `歷史最低: ${steamLow.data.lowest.price}, -${steamLow.data.lowest.discount}%, ${formatDate(new Date(steamLow.data.lowest.date))}\n`
          }
        } else if (appInfo.type === 'sub') {
          htmlString = await rp(`https://store.steampowered.com/api/packagedetails/?packageids=${appInfo.id}&cc=tw`)
          const steamOV = JSON.parse(htmlString)
          if (steamOV[appInfo.id].success) {
            const { price } = steamOV[appInfo.id].data
            rSteam += `原價:  NT$ ${price.initial / 100}\n` +
              `單買原價:  NT$ ${price.individual / 100}\n` +
              `目前價格:  NT$ ${price.final / 100}, -${price.discount_percent}%\n`
          }
        }

        replyText += rSteam
      }

      replyText += rInfo
    }
  } catch (err) {
    console.log(err)
    if (replyText.length > 0) reply.push({ type: 'text', text: replyText })
    else reply.push({ type: 'text', text: '遊戲資料查詢失敗，請稍後再試' })
  }
  return reply
}

bot.on('message', (event) => {
  const msg = event.message.text
  if (msg && msg.substring(0, 6) === '!itad ') {
    const name = msg.split('!itad ')[1]
    getItadData(name).then((reply) => {
      event.reply(reply)
    })
  }
})

bot.listen('/', process.env.PORT, () => {
  console.log(`Bot is ready in ${process.env.PORT}`)
})
