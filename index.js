require('dotenv').config();
const linebot = require('linebot');
const rp = require('request-promise');

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
    return list.title == name;
  });
}

const getSteamIDByPlain = (json, plain) => {
  let steam = json.data.list.filter((list)=>{
    return list.plain == plain && list.shop.id == 'steam';
  });
  if(steam.length > 0){
    let steamUrl = steam[0].urls.buy;
    let id = steamUrl.match( /\/(app|sub|bundle|friendsthatplay|gamecards|recommended)\/([0-9]{1,7})/ );
    return id ? parseInt( id[ 2 ], 10 ) : -1;
  }
  else return -1;
}

const itadShops = "amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore";

bot.on('message', function(event) {
  const msg = event.message.text;
  if (msg && msg.substring(0, 6) == '!itad ') {
    let name = msg.split('!itad ')[1];
    let q = encodeURIComponent(name.trim());

    // Get plain
    rp(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${q}&offset=&limit=&region=us&country=US&shops=${itadShops}`)
      .then((res)=>{
        let json = JSON.parse(res);
        let find = getItadPlainByName(json, name);
        if(find.length == 0){
          if(json.data.list.length == 0) event.reply("找不到符合的遊戲");
          else {
            let reply = `找不到符合的遊戲，你是不是要找...\n`;
            for(let i=0;i<5;i++){
              if(json.data.list[i]) reply += `- ${json.data.list[i].title}\n`;
            }
            event.reply(reply);
          }
        }
        else {
          let plain = find[0].plain;
          let appId = getSteamIDByPlain(json, plain);

          // get history best
          rp(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&region=us&country=US&shops=${itadShops}`)
            .then((res)=>{
              let lowest = JSON.parse(res).data[plain];
              let lowestDate = new Date(lowest.added*1000);
              
              // get current best
              rp(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&region=us&country=US&shops=${itadShops}`)
                .then((res)=>{
                  let current = JSON.parse(res).data[plain].list[0];
                  let replyText = `${name}\n歷史最低: ${lowest.price}USD, -${lowest.cut}%, ${lowestDate.toLocaleDateString()}在${lowest.shop.name}\n目前最低: ${current.price_new}USD, -${current.price_cut}%\n${current.url}`;
                  if(appId == -1) event.reply(replyText);
                  else event.reply([ {
                    type: 'image',
                    originalContentUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`,
                    previewImageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
                  },  { type: 'text', text: replyText }])
                })
                .catch((err)=>{
                  console.log(err);
                  event.reply("目前最低價查詢失敗，請稍後再試");
                })
            })
            .catch((err)=>{
              console.log(err);
              event.reply("歷史最低價查詢失敗，請稍後再試");
            })
        }
      })
      .catch((err)=>{
        console.log(err);
        event.reply("遊戲資料查詢失敗，請稍後再試");
      })
  }
});

bot.listen('/', process.env.PORT, () => {
  console.log('Bot is ready in ' + process.env.PORT);
});
