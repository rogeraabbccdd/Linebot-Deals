require('dotenv').config();
const linebot = require('linebot');
const rp = require('request-promise');
const schedule = require('node-schedule');
const cloudscraper = require('cloudscraper');

const bot = linebot({
  channelId: process.env.CHANNEL_ID,
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

Date.prototype.toLocaleDateString = function () {
  return `${this.getFullYear()}年${this.getMonth() + 1}月${this.getDate()}日`;
};

const getItadPlainByName = (json, name) => {
  return json.data.list.filter((list)=>{
    return list.title.trim().toUpperCase() === name.trim().toUpperCase();
  });
}

const getSteamInfoByPlain = (json, plain) => {
  let steam = json.data.list.filter((list)=>{
    return list.plain === plain && list.shop.id === 'steam';
  });
  if(steam.length > 0){
    let steamUrl = steam[0].urls.buy;
    let info = steamUrl.match( /\/(app|sub|bundle|friendsthatplay|gamecards|recommended)\/([0-9]{1,7})/ );
    return info ? {id: parseInt( info[ 2 ], 10 ), type: info[1] }: { id: -1, type: 'null'};
  }
  else return {id: -1, type: 'null'};
}

const itadShops = 'amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore';

let exRateUSDTW = 30;

const exRateUpdate = () => {
  rp(`https://tw.rter.info/capi.php`).then((res)=>{
    exRateUSDTW = Math.round(JSON.parse(res).USDTWD.Exrate * 100) / 100;
  })
}

exRateUpdate();

schedule.scheduleJob('* * 0 * * *', function(){
  exRateUpdate();
});

bot.on('message', function(event) {
  const msg = event.message.text;
  if (msg && msg.substring(0, 6) === '!itad ') {
    let name = msg.split('!itad ')[1];
    let q = encodeURIComponent(name.trim());

    // Get plain
    rp(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${q}&offset=&limit=&region=us&country=US&shops=${itadShops}`)
      .then((res)=>{
        let json = JSON.parse(res);
        let find = getItadPlainByName(json, name);
        if(find.length === 0){
          if(json.data.list.length === 0) event.reply('找不到符合的遊戲');
          else {
            json.data.list.sort((a, b)=>{
              return a.title.length - b.title.length || a.title.localeCompare(b.title);
            });
            let reply = `找不到符合的遊戲，你是不是要找...\n`;

            // j = array index
            let j = 0;
            // i = max 5 suggestions
            for(let i=0;i<5;i++){
              if(json.data.list[j]) {
                if((j === 0) || (j > 0 && !reply.includes(json.data.list[j].title))){
                  reply += `- ${json.data.list[j].title}\n`;
                }
                else i--;
              }
              else break;
              j++;
            }
            event.reply(reply);
          }
        }
        else {
          let plain = find[0].plain;
          let appTitle = find[0].title;
          let appInfo = getSteamInfoByPlain(json, plain);

          // get history best
          rp(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&region=us&country=US&shops=${itadShops}`)
            .then((res)=>{
              let lowest = JSON.parse(res).data[plain];
              let lowestDate = new Date(lowest.added*1000);
              
              // get current best
              rp(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&region=us&country=US&shops=${itadShops}`)
                .then((res)=>{
                  let current = JSON.parse(res).data[plain].list[0];
                  let replyTextDeal = `${appTitle}\n`+
                                `.\n` +
                                `IsThereAnyDeal:\n` +
                                `原價: ${current.price_old} USD / ${Math.round(current.price_old*exRateUSDTW*100)/100} TWD\n` +
                                `目前最低: ${current.price_new} USD / ${Math.round(current.price_new*exRateUSDTW*100)/100} TWD, -${current.price_cut}%, 在 ${current.shop.name}\n` +
                                `歷史最低: ${lowest.price} USD / ${Math.round(lowest.price*exRateUSDTW*100)/100} TWD, -${lowest.cut}%, ${lowestDate.toLocaleDateString()} 在 ${lowest.shop.name}\n` +
                                `${current.url}\n`;
                  
                  let replyTextSteam = '.\nSteam:\n';

                  let replyTextInfo = '.\n' +
                                    `更多資訊:\n` +
                                    `https://isthereanydeal.com/game/${plain}/info/\n`;
                  
                  // is steam
                  if(appInfo.id != -1) {
                    replyTextInfo += `https://store.steampowered.com/${appInfo.type}/${appInfo.id}/\n` + 
                                    `https://steamdb.info/${appInfo.type}/${appInfo.id}/`;

                    // get twd info
                    if(appInfo.type === 'app'){
                      let replyImage = {
                          type: 'image',
                          originalContentUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`,
                          previewImageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`
                      };

                      rp(`http://store.steampowered.com/api/appdetails/?appids=${appInfo.id}&cc=tw&filters=price_overview`)
                        .then((res)=>{
                          let appTWPrice = JSON.parse(res);
                          
                          // check ok
                          if(appTWPrice[appInfo.id].success && typeof appTWPrice[appInfo.id].data.length != 'array') {
                            let price_overview = appTWPrice[appInfo.id].data.price_overview;
                            replyTextSteam += `原價: ${price_overview.initial_formatted.length === 0 ? price_overview.final_formatted : price_overview.initial_formatted}, \n` +
                                              `目前價格: ${price_overview.final_formatted}, -${price_overview.discount_percent}%\n`

                            // check steamdb for history low
                            cloudscraper.get(`https://steamdb.info/api/ExtensionGetPrice/?appid=${appInfo.id}&currency=TWD`)
                              .then((res)=>{
                                let json = JSON.parse(res);
                                if(json.success) replyTextSteam += `歷史最低: ${json.data.lowest.price}, -${json.data.lowest.discount}%, ${new Date(json.data.lowest.date).toLocaleDateString()}\n`;
                                else replyTextSteam += `歷史最低: SteamDB 查詢失敗\n`;

                                event.reply([ replyImage, { type: 'text', text: replyTextDeal + replyTextSteam + replyTextInfo }]);
                              })
                              .catch((err)=>{
                                console.log(err);
                                replyTextSteam += `歷史最低: SteamDB 查詢失敗，請求被對方拒絕\n`;

                                event.reply([ replyImage, { type: 'text', text: replyTextDeal + replyTextSteam + replyTextInfo }]);
                              });
                          }
                          else {
                            replyTextSteam += '目前價格: Steam 查詢失敗\n';
                            
                            event.reply([ replyImage, { type: 'text', text: replyTextDeal + replyTextSteam + replyTextInfo }]);
                          }
                        })
                        .catch((err)=>{
                          console.log(err);
                          replyTextSteam += '目前價格: Steam 查詢失敗\n'
                          event.reply([ replyImage, { type: 'text', text: replyTextDeal + replyTextSteam + replyTextInfo }]);
                        })
                    }
                    else if(appInfo.type === 'sub'){
                      rp(`https://store.steampowered.com/api/packagedetails/?packageids=${appInfo.id}&cc=tw`)
                        .then((res)=>{
                          let appTWPrice = JSON.parse(res);
                          if(appTWPrice[appInfo.id].success) {
                            let price = appTWPrice[appInfo.id].data.price
                            replyTextSteam += `原價:  NT$ ${price.initial/100}\n` +
                                              `單買原價:  NT$ ${price.individual/100}\n` +
                                              `目前價格:  NT$ ${price.final/100}, -${price.discount_percent}%\n`;
                            
                            event.reply(replyTextDeal + replyTextSteam + replyTextInfo);
                          }
                          else {
                            replyTextSteam += '目前價格: Steam 沒有提供這個組合包的資料\n'
                            event.reply(replyTextDeal + replyTextSteam + replyTextInfo);
                          }
                        })
                        .catch((err)=>{
                          console.log(err);
                          replyTextSteam += '目前價格: Steam 查詢失敗\n'
                          event.reply(replyTextDeal + replyTextSteam + replyTextInfo);
                        })
                    }
                    else {
                      replyTextSteam += 'Steam 沒有提供這個組合包的資料\n'
                      event.reply(replyTextDeal + replyTextSteam + replyTextInfo);
                    }
                  }
                  else {
                    event.reply(replyTextDeal + replyTextInfo);
                  }
                })
                .catch((err)=>{
                  console.log(err);
                  event.reply('IsThereAnyDeal 目前最低價查詢失敗，請稍後再試');
                })
            })
            .catch((err)=>{
              console.log(err);
              event.reply('IsThereAnyDeal 歷史最低價查詢失敗，請稍後再試');
            })
        }
      })
      .catch((err)=>{
        console.log(err);
        event.reply('遊戲資料查詢失敗，請稍後再試');
      })
  }
});

bot.listen('/', process.env.PORT, () => {
  console.log('Bot is ready in ' + process.env.PORT);
});
