require('dotenv').config()
const express = require('express')
const linebot = require('linebot')
const schedule = require('node-schedule')

const searchITAD = require('./funcs/searchITAD')
const getItadPlainByName = require('./funcs/getItadPlainByName')
const exRateUpdate = require('./funcs/exRateUpdate')
const getSteamInfoByPlain = require('./funcs/getSteamInfoByPlain')
const formatDate = require('./funcs/formatDate')
const fetchItad = require('./funcs/fetchItad')
const fetchSteamApp = require('./funcs/fetchSteamApp')
const fetchSteamDB = require('./funcs/fetchSteamDB')
const fetchSteamPackage = require('./funcs/fetchSteamPackage')

const app = express()

const bot = linebot({
  channelId: process.env.CHANNEL_ID,
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
})

const itadShops = 'amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore'

let exRateUSDTW = 30

schedule.scheduleJob('0 0 0 * * *', async () => {
  exRateUSDTW = await exRateUpdate()
})

const getItadData = async (name) => {
  const reply = []
  try {
    /* search game */
    const search = await searchITAD(name, itadShops)
    const find = getItadPlainByName(search, name)
    if (find.length === 0) {
      if (search.length === 0) reply.push({ type: 'text', text: '找不到符合的遊戲' })
      else {
        // remove duplicate title in result and sort
        const data = search.filter((arr, index, self) =>
          index === self.findIndex((t) => (t.title === arr.title))
        ).sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))

        let suggestions = '找不到符合的遊戲，你是不是要找...\n'

        // j = array index
        let j = 0
        // i = max 5 suggestions
        for (let i = 0; i < 5; i++) {
          if (data[j]) {
            if ((j === 0) || (j > 0 && !reply.includes(data[j].title))) {
              suggestions += `- ${data[j].title}\n`
            } else i--
          } else break
          j++
        }

        reply.push({ type: 'text', text: suggestions })
      }
    } else {
      const { plain } = find[0]
      const appTitle = find[0].title
      const appInfo = getSteamInfoByPlain(search, plain)

      const itad = await fetchItad(plain, itadShops)
      const lowest = itad[0].data[plain]
      const current = itad[1].data[plain].list[0]
      const bundle = itad[2].data[plain]

      const flex = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: []
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'link',
              action: {
                type: 'uri',
                label: 'IsThereAnyDeal',
                uri: `https://isthereanydeal.com/game/${plain}/info/`
              },
              height: 'sm'
            }
          ]
        },
        styles: {
          footer: {
            separator: true
          }
        }
      }

      flex.body.contents.push(
        // title text
        {
          type: 'text',
          text: appTitle,
          size: 'xl',
          weight: 'bold'
        },
        // itad info
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'icon',
                  url: 'https://raw.githubusercontent.com/rogeraabbccdd/Linebot-Deals/flex/itad.png'
                },
                {
                  type: 'text',
                  text: 'IsThereAnyDeal',
                  weight: 'bold',
                  margin: 'sm',
                  flex: 0,
                  align: 'center'
                }
              ],
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '原價',
                  flex: 1,
                  size: 'sm',
                  color: '#aaaaaa'
                },
                {
                  type: 'text',
                  flex: 5,
                  size: 'sm',
                  color: '#666666',
                  wrap: true,
                  text: `${current.price_old} USD / ${Math.round(current.price_old * exRateUSDTW * 100) / 100} TWD`
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '目前',
                  flex: 1,
                  size: 'sm',
                  color: '#aaaaaa'
                },
                {
                  type: 'text',
                  flex: 5,
                  size: 'sm',
                  color: '#666666',
                  wrap: true,
                  text: `${current.price_new} USD / ${Math.round(current.price_new * exRateUSDTW * 100) / 100} TWD, -${current.price_cut}%, 在 ${current.shop.name}`
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '歷史',
                  flex: 1,
                  size: 'sm',
                  color: '#aaaaaa'
                },
                {
                  type: 'text',
                  flex: 5,
                  size: 'sm',
                  color: '#666666',
                  wrap: true,
                  text: `${lowest.price} USD / ${Math.round(lowest.price * exRateUSDTW * 100) / 100} TWD, -${lowest.cut}%, ${formatDate(new Date(lowest.added * 1000))}在 ${lowest.shop.name}`
                }
              ]
            }
          ],
          spacing: 'sm',
          margin: 'md'
        }
      )

      /* Steam */
      if (appInfo.id !== -1) {
        flex.footer.contents.push(
          {
            type: 'button',
            style: 'link',
            action: {
              type: 'uri',
              label: 'Steam',
              uri: `https://store.steampowered.com/${appInfo.type}/${appInfo.id}/`
            },
            margin: 'md',
            height: 'sm'
          },
          {
            type: 'button',
            style: 'link',
            action: {
              type: 'uri',
              label: 'SteamDB',
              uri: `https://steamdb.info/${appInfo.type}/${appInfo.id}/`
            },
            margin: 'md',
            height: 'sm'
          }
        )

        if (appInfo.type === 'app') {
          flex.hero = {
            type: 'image',
            url: `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`,
            size: 'full',
            aspectRatio: '460:215',
            aspectMode: 'cover'
          }

          const steamOV = await fetchSteamApp(appInfo.id)

          if (steamOV[appInfo.id].success && typeof steamOV[appInfo.id].data === 'object') {
            const price = steamOV[appInfo.id].data.price_overview

            const steamLow = await fetchSteamDB(appInfo.id)

            if (Object.keys(steamLow).length > 0) {
              const lowestRegex = /(?<date1>\d+\s[A-Za-z]+\s+\d+)\s\((?<times>\d+)\stimes,\sfirst\son\s(?<date2>\d+\s[A-Za-z]+\s+\d+)\)/
              const lowestResults = steamLow.data.lowest.date.match(lowestRegex)
              let lowestStr = ''
              if (lowestResults) lowestStr += `最近一次為 ${formatDate(new Date(lowestResults.groups.date1))}, 從 ${formatDate(new Date(lowestResults.groups.date2))}開始共出現 ${lowestResults.groups.times} 次`
              else lowestStr += formatDate(new Date(steamLow.data.lowest.date))

              flex.body.contents.push(
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'box',
                      layout: 'baseline',
                      contents: [
                        {
                          type: 'icon',
                          url: 'https://raw.githubusercontent.com/rogeraabbccdd/Linebot-Deals/flex/steam.png'
                        },
                        {
                          type: 'text',
                          text: 'Steam',
                          weight: 'bold',
                          margin: 'sm',
                          flex: 0,
                          align: 'center'
                        }
                      ],
                      margin: 'md'
                    },
                    {
                      type: 'box',
                      layout: 'baseline',
                      contents: [
                        {
                          type: 'text',
                          text: '原價',
                          flex: 1,
                          size: 'sm',
                          color: '#aaaaaa'
                        },
                        {
                          type: 'text',
                          flex: 5,
                          size: 'sm',
                          color: '#666666',
                          wrap: true,
                          text: `${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}`
                        }
                      ]
                    },
                    {
                      type: 'box',
                      layout: 'baseline',
                      contents: [
                        {
                          type: 'text',
                          text: '目前',
                          flex: 1,
                          size: 'sm',
                          color: '#aaaaaa'
                        },
                        {
                          type: 'text',
                          flex: 5,
                          size: 'sm',
                          color: '#666666',
                          wrap: true,
                          text: `${price.final_formatted}, -${price.discount_percent}%`
                        }
                      ]
                    },
                    {
                      type: 'box',
                      layout: 'baseline',
                      contents: [
                        {
                          type: 'text',
                          text: '歷史',
                          flex: 1,
                          size: 'sm',
                          color: '#aaaaaa'
                        },
                        {
                          type: 'text',
                          flex: 5,
                          size: 'sm',
                          color: '#666666',
                          wrap: true,
                          text: `${steamLow.data.lowest.price}, -${steamLow.data.lowest.discount}%, ${lowestStr}`
                        }
                      ]
                    }
                  ],
                  margin: 'md'
                }
              )
            }
          }
        } else if (appInfo.type === 'sub') {
          const steamOV = await fetchSteamPackage(appInfo.id)
          if (steamOV[appInfo.id].success) {
            const { price } = steamOV[appInfo.id].data

            flex.body.contents.push(
              {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'icon',
                        url: 'https://raw.githubusercontent.com/rogeraabbccdd/Linebot-Deals/flex/steam.png'
                      },
                      {
                        type: 'text',
                        text: 'Steam',
                        weight: 'bold',
                        margin: 'sm',
                        flex: 0,
                        align: 'center'
                      }
                    ],
                    margin: 'md'
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: '原價',
                        flex: 1,
                        size: 'sm',
                        color: '#aaaaaa'
                      },
                      {
                        type: 'text',
                        flex: 5,
                        size: 'sm',
                        color: '#666666',
                        wrap: true,
                        text: `NT$ ${price.initial / 100}`
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: '目前',
                        flex: 1,
                        size: 'sm',
                        color: '#aaaaaa'
                      },
                      {
                        type: 'text',
                        flex: 5,
                        size: 'sm',
                        color: '#666666',
                        wrap: true,
                        text: `NT$ ${price.final / 100}, -${price.discount_percent}%`
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: '單買',
                        flex: 1,
                        size: 'sm',
                        color: '#aaaaaa'
                      },
                      {
                        type: 'text',
                        flex: 5,
                        size: 'sm',
                        color: '#666666',
                        wrap: true,
                        text: `NT$ ${price.individual / 100}`
                      }
                    ]
                  }
                ],
                margin: 'md'
              }
            )
          }
        }
      }
      // current.url
      // https://isthereanydeal.com/game/${plain}/info/

      flex.body.contents.push(
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'icon',
                  url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png'
                },
                {
                  type: 'text',
                  text: '入包',
                  flex: 0,
                  margin: 'sm',
                  weight: 'bold',
                  align: 'center'
                }
              ],
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '紀錄',
                  flex: 1,
                  size: 'sm',
                  color: '#aaaaaa'
                },
                {
                  type: 'text',
                  flex: 5,
                  size: 'sm',
                  color: '#666666',
                  wrap: true,
                  text: `${bundle.total}`
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '目前',
                  flex: 1,
                  size: 'sm',
                  color: '#aaaaaa'
                },
                {
                  type: 'text',
                  flex: 5,
                  size: 'sm',
                  color: '#666666',
                  wrap: true,
                  text: `${bundle.list.length}`
                }
              ]
            }
          ],
          spacing: 'sm',
          margin: 'md'
        }
      )

      reply.push({
        type: 'flex',
        altText: `查詢 ${appTitle} 的結果`,
        contents: {
          type: 'carousel',
          contents: [flex]
        }
      })
    }
  } catch (err) {
    console.log(err)
    reply.push({ type: 'text', text: '遊戲資料查詢失敗，請稍後再試' })
  }
  return reply
}

bot.on('message', async event => {
  const msg = event.message.text
  if (msg) {
    if (msg === '!itadhelp') {
      const reply =
        '歡迎使用 Steam 查價機器人\n\n' +
        '機器人指令:\n' +
        '◆ "!itad 遊戲名稱" - 查詢遊戲資訊\n' +
        '◆ "!itadhelp" - 顯示幫助訊息\n' +
        '\n相關連結:\n' +
        '◆ 巴哈文章: https://ppt.cc/fMvT6x\n' +
        '◆ 機器人ID:  @504mcsmm\n' +
        '◆ 機器人原始碼: https://ppt.cc/f2YdNx\n'
      event.reply(reply)
    } else if (msg.substring(0, 6) === '!itad ') {
      try {
        const name = msg.split('!itad ')[1]
        const reply = await getItadData(name)
        await event.reply(reply)
      } catch (error) {
        event.reply('遊戲資料查詢失敗，請稍後再試')
      }
    }
  }
})

// bot.listen('/', process.env.PORT, async () => {
//   exRateUSDTW = exRateUpdate()
//   console.log(`Bot is ready in ${process.env.PORT}`)
// })

const linebotParser = bot.parser()

app.post('/linewebhook', linebotParser)

app.get('/', (req, res) => {
  res.status(200).send('')
})

app.listen(process.env.PORT || 3000, () => {
  exRateUSDTW = exRateUpdate()
  console.log(`Bot is ready in ${process.env.PORT}`)
})
