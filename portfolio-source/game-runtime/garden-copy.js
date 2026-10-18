(function(root){const p=(en,zh)=>({en,zh});root.GardenCopy={
play:p('Garden','花园'),codex:p('Almanac','图鉴'),trailer:p('Trailer','预告'),author:p('Author','作者'),start:p('Start planting','开始种植'),continue:p('Continue','继续冒险'),resume:p('Resume','继续'),pause:p('Pause','暂停'),menu:p('Menu','菜单'),sun:p('SUN','阳光'),score:p('Score','得分'),wave:p('Wave','波'),next:p('Next wave','下波'),starts:p('Zombies arrive in','僵尸即将到来'),squad:p('Bring your plants','带上你的植物'),squadHint:p('Choose from the plants you have earned.','从已获得的植物中，选择这一关的阵容。'),chooseSix:p('Choose six plants','请选择六种植物'),chooseAll:p('Bring all available plants','带上全部已解锁植物'),recommended:p('Recommended squad','推荐阵容'),begin:p('Into the garden','进入花园'),plants:p('Plants','植物'),zombies:p('Zombies','僵尸'),journey:p('Adventure','冒险'),locked:p('Not unlocked','尚未解锁'),unseen:p('Not encountered','尚未遇见'),after:p('Awarded after','通关后获得'),found:p('Discovered','已发现'),earned:p('Collected','已获得'),health:p('Health','生命'),cost:p('Sun cost','阳光消耗'),recharge:p('Recharge','冷却'),damage:p('Damage','伤害'),close:p('Close','关闭'),shovel:p('Shovel','铲子'),collect:p('Collect sun (E)','收集阳光（E）'),selected:p('Selected','已选择'),removeHint:p('Remove a plant. Clearing a stone costs 50 sun.','点击植物移除；清理石块消耗 50 阳光。'),energyError:p('More sun needed.','阳光还不够。'),cooldownError:p('This seed is still recharging.','这袋种子还在冷却。'),laneError:p('Only open lanes can be planted.','只能种在当前开放的路线。'),rockError:p('Clear this stone with the shovel for 50 sun.','用铲子清理石块，需要 50 阳光。'),emptyError:p('Nothing to remove, or not enough sun for the stone.','这里没有可移除的植物，或阳光不足以清理石块。'),upgrade:p('Upgrade','升级'),upgradeLocked:p('Upgrades open after 2-3.','通关 2-3 后开放升级。'),maxLevel:p('Fully grown','已升至三级'),singleUse:p('Single use','一次性植物'),tier:p('Tier','等级'),level:p('Level','关卡'),won:p('Garden defended','院子守住了'),wonBody:p('A new plant for the next morning.','院子守住了。带上新植物，准备下一关吧。'),wonNoPlant:p('Your garden is safe. Keep going.','院子守住了，继续往前走。'),lost:p('The zombies got through','僵尸进院子了'),lostBody:p('Plant more sun early and cover each open lane.','试试更早种下阳光植物，也别忘了照看每条开放路线。'),retry:p('Try this level again','再试这一关'),nextLevel:p('Next level','下一关'),newPlant:p('New plant','获得新植物'),complete:p('Adventure complete','冒险完成'),completeBody:p('You held the last garden. Adventure complete.','最后的院子守住了，你已完成全部冒险。'),newAdventure:p('Start a new adventure','重新开始冒险'),restartQuestion:p('Begin a new adventure?','重新开始冒险？'),restartBody:p('This clears the campaign and discoveries on this device.','这会清除当前设备上的战役进度、植物和图鉴记录。'),confirmReset:p('Start over','重新开始'),cancel:p('Keep playing','保留进度'),paused:p('Game paused','游戏已暂停'),pausedBody:p('Take your time. Everything is paused.','不用着急，所有东西都已暂停。'),settings:p('Garden settings','花园设置'),sound:p('Sound','声音'),music:p('Music','音乐'),auto:p('Auto-collect sun','自动收集阳光'),speed:p('Game speed','游戏速度'),fullscreen:p('Fullscreen','全屏'),help:p('How to play','怎么玩'),restart:p('Restart this level','重试当前关'),waveClear:p('A little breathing room · +75 sun','喘口气 · +75 阳光'),incoming:p('The zombies are coming','僵尸来了'),finalWave:p('Final wave','最后一波'),sweep:p('Emergency mower!','割草机出动！'),enrage:p('The Hollow King is enraged','空壳之王狂暴了'),best:p('Best waves','最高波数'),guards:p('Mowers left','剩余割草机'),kills:p('Zombies stopped','击败僵尸'),finished:p('Complete','已通关'),current:p('You are here','正在这里'),future:p('Not yet','未到达'),bookTitle:p('The garden almanac','花园图鉴'),bookIntro:p('Plants you have grown. Zombies you have met.','种过的花，见过的怪。'),journeyTitle:p('Adventure progress','冒险进度'),journeyIntro:p('Clear this level to keep going.','守住当前院子，才能前往下一关。'),noSkip:p('Clear the previous level first.','先完成上一关。'),deckFull:p('Six slots are full. Remove one first.','六格种子槽已满，请先取消一种植物。'),copied:p('Copied.','已复制。'),phone:p('Phone','手机号'),contact:p('Contact','联系'),personal:p('Personal game portfolio','个人游戏作品'),back:p('Back to the garden','返回花园'),trailerTitle:p('Sprout Patrol','萌芽保卫队'),trailerIntro:p('From the first morning to the last night.','从第一个清晨，到最后一场夜战。'),trailerFeatures:p('A sequential adventure. New plants. One garden to protect.','逐关冒险 · 收集植物 · 守住花园'),videoFallback:p('Download the trailer if your browser cannot play it.','当前浏览器无法播放视频时，可下载预告。'),downloadVideo:p('Download trailer','下载预告'),controls:p('1–6 plants · E sun · P pause · U upgrade · 0 shovel','1–6 选植物 · E 阳光 · P 暂停 · U 升级 · 0 铲子'),canvasLabel:p('Garden defense. Arrow keys choose a tile; Enter plants.','草坪塔防。方向键选择格子，回车种植。'),fullscreenError:p('Fullscreen is unavailable in this browser.','当前浏览器不支持全屏。'),harvestTip:p('Click the suns to collect them.','点击阳光，收进阳光槽。'),saveHint:p('Progress is saved on this device.','冒险进度保存在当前设备。'),guideTitle:p('How to play','游戏指南'),guide1Title:p('Start with sun.','先种阳光。'),guide1:p('Sunbuds produce planting resources. Click suns or press E to collect them all.','太阳芽产出种植需要的阳光。点击收集，或按 E 一次收集全部。'),guide2Title:p('Cover the open lanes.','照看每条开放路线。'),guide2:p('Choose a seed and an empty spot. Each mower saves its lane once.','选择种子，再点空地。每条路线的割草机只能救场一次。'),guide3Title:p('Grow one level at a time.','一关一关地成长。'),guide3:p('Wins award plants. Meet a zombie to reveal it in the almanac.','通关推进冒险并奖励植物，遇见僵尸以后，图鉴才会显示它的能力。'),guide4Title:p('Make room and make choices.','留出空间，也做好取舍。'),guide4:p('Shovel opens after 1-2. Upgrades open after 2-3. A larger collection means choosing six plants.','通关 1-2 获得铲子，通关 2-3 开放升级。植物变多后，每关只能带六种。'),guide5Title:p('Leave and come back.','出去走走，再回来。'),guide5:p('Opening another page pauses and saves this tab’s battle. Continue when you return.','打开其他页面会暂停并保存本标签页的战斗，回来后可以继续。通关记录保存在当前设备。')
};})(globalThis);
(function(root){const p=(en,zh)=>({en,zh});Object.assign(root.GardenCopy,{
flower:p('Bloom','开花进化'),sprout:p('Sprout · 50% output','萌芽态 · 半输出'),adult:p('Mature','成株态'),flowered:p('Flowered · double output','开花态 · 双倍输出'),growing:p('Protect it until it matures','护住它，等它长大'),growthHint:p('Sprouts cost 60% and work at half strength. Survive 40 seconds, then bloom with U.','萌芽价格为成株的六成、输出一半。存活 40 秒长成成株，再花阳光开花。'),bloomHint:p('Double health and output, plus a role bonus.','生命与输出翻倍，并获得职能附加效果。'),rating:p('Garden rating','花园评级'),gateStar:p('No lane breached','没有路线失守'),timeStar:p('Within target time','在目标用时内'),sunStar:p('Save enough sun','留足阳光'),goal:p('Garden objective','本关目标'),goalLimit:p('At most this many living plants:','同时存活植物上限：'),goalBudget:p('Sun spending limit:','阳光支出上限：'),goalProtect:p('Protect the plant at row–column','保护指定植物，行–列'),goalTime:p('Finish before the timer:','倒计时内守住院子：'),goalRoster:p('Use only the assigned seed pool','只能使用本关指定植物'),limitError:p('Too many living plants for this garden.','这关已经种满了，先做好取舍。'),budgetError:p('This would exceed the level sun budget.','这次支出会超过本关阳光预算。'),tutorialError:p('Follow the highlighted step first.','先完成高亮的教学步骤。'),protectedError:p('This plant is the garden objective.','这株是本关要保护的植物。'),focus:p('Focus fire: click a visible zombie','集火：点击看得见的僵尸'),focused:p('Focus target pinned','已标记集火目标'),firstPlant:p('A new seed in the garden','院子里来了新植物'),firstEnemy:p('A new visitor','新的来客'),nextVisitor:p('Next wave: an unfamiliar silhouette','下一波：陌生来客的剪影'),flag:p('Big wave in','大波来袭倒计时'),tutorial0:p('Click the glowing sun. The garden needs it.','先点亮着的阳光。院子需要它。'),tutorial1:p('Tap the Sunbud seed packet.','点亮着的太阳芽种子袋。'),tutorial2:p('Tap the glowing grass spot to plant a Sunbud.','点亮着的草格，种下太阳芽。'),tutorial3:p('Collect sun and plant TWO Seed Slingers in the middle lane.','继续收阳光，在中间路线种下两株种子投手。'),tutorial4:p('Zombies reaching the house lose this tutorial. Protect your sprouts.','这一关没有救场割草机。僵尸到屋前就失败，护好幼芽。'),tutorial5:p('The first wave is over. Tap the shovel.','第一波守住了。现在点铲子。'),tutorial6:p('Shovel the practice bud on the right. Your real plants stay.','铲掉右边亮着的练习芽，真正的防线留着。'),tutorial7:p('Now the garden is yours. Keep both shooters alive.','学会了，院子交给你。继续护住两株射手。'),retry:p('Retry this garden','再试这座院子'),menu:p('Pause menu','暂停菜单'),title:p('Return to title','回到标题'),selectLevel:p('Completed gardens','已通关选关'),challenge:p('Challenges','挑战'),journal:p('Garden journal','花园手记'),endless:p('Endless','无尽模式'),daily:p('Daily garden','每日挑战'),endlessGoal:p('Completed waves are your result','撑过的波数就是成绩'),wavesCompleted:p('waves completed','波已守住'),retire:p('End this endless run','结束本次无尽'),modeLocked:p('Clear world one to unlock challenges.','通关清晨世界后开放挑战。'),dailyHint:p('Same seed and six borrowed plants for everyone today. No campaign unlocks.','今日固定种子与六种借用植物；挑战不会奖励战役植物。'),dailyReset:p('Resets at midnight in China Standard Time.','每日北京时间 00:00 更新。'),localBoard:p('This device’s board','本机排行榜'),noRecords:p('The garden is waiting for your first record.','院子还等着你的第一份战绩。'),shareResult:p('Copy result + link','复制战绩与链接'),upgrades:p('Small comforts','小小的改善'),upgradeIntro:p('Spend best campaign stars. Replaying improves your rating; upgrades stay modest.','花费战役最佳评级星星。重玩提高评级，永久升级只带来小幅便利。'),starBank:p('Stars available','可用星星'),buy:p('Exchange stars','用星星兑换'),maxUpgrade:p('At the small limit','已达到上限'),starsNeeded:p('Earn more campaign stars first.','先在冒险里多攒几颗星。'),achievements:p('Garden keepsakes','花园成就'),earnedBadge:p('Keepsake earned','获得成就'),weakness:p('Watch out','弱点提示'),synergy:p('Good company','组合协同'),personality:p('A garden personality','一句人设'),progress:p('Progress','进度'),soundVolume:p('Effects volume','音效音量'),musicVolume:p('Music volume','音乐音量'),fontSize:p('Text size','字号'),noShake:p('Disable camera shake','关闭屏幕震动'),difficulty:p('Difficulty','难度'),difficultyNotice:p('Changing difficulty restarts the current garden.','切换难度会重试当前院子。'),autoCasual:p('Auto-collection is available only in Casual.','自动收集阳光仅休闲档可用。'),assistance:p('This garden has been stubborn three times.','这座院子已经倔强了三次。'),assistBody:p('Try Casual or the recommended squad. Your choice.','可以试试休闲档或推荐阵容，由你决定。'),chooseCasual:p('Try Casual','试试休闲档'),remap:p('Keyboard bindings','修改键位'),keyConflict:p('Each key must be a unique single character. Esc stays the menu key.','每个动作需要不同的单个键；Esc 始终打开菜单。'),controls:p('Tap a seed, then a grass spot. Click zombies to focus fire.','点种子袋，再点草格。点可见的僵尸可标记集火。'),restoreCount:p('Back to the garden in','继续倒计时'),feedback:p('Feedback','反馈'),feedbackHint:p('Version, level and a checked save code are included. Copy and share it with the author.','自动附带版本、关卡和校验存档码。复制后可发给作者。'),feedbackNote:p('Where did the garden get you stuck?','这座院子在哪里把你难住了？'),copyFeedback:p('Copy feedback','复制反馈'),copyFail:p('Copy failed. Select the text and copy it manually.','复制未成功，请选中文字后手动复制。'),saveTools:p('Carry your garden','带走你的院子'),exportSave:p('Export save code','导出存档码'),importSave:p('Import save code','导入存档码'),saveLabel:p('Versioned save code with integrity check','带版本与校验的存档码'),importHint:p('Import replaces this device’s progress after an automatic backup.','导入前自动备份，再替换本设备进度。'),importBad:p('This save code is invalid, damaged or from an unsupported version.','存档码无效、校验失败或版本不支持。'),importOk:p('Your garden has arrived.','你的院子搬过来了。'),backups:p('Last three automatic backups','最近三次自动备份'),backupFirst:p('Back up, then continue','先备份，再继续'),finalReset:p('Confirm a fresh adventure','确认清空并重开'),resetAgain:p('One last check. A backup has been saved.','再确认一次，旧存档已自动备份。'),resetHint:p('You can restore the previous garden with its backup code.','可用备份码恢复原来的院子。'),saveCopied:p('Save code copied. Keep it somewhere safe.','存档码已复制，请另存好。'),version:p('Version','版本'),changes:p('Garden updates','更新日志'),exportMetrics:p('Export local play records','导出本地游玩记录'),metricsHint:p('Only this device records attempts, time and failed lanes. Nothing is uploaded.','仅本设备记录尝试、用时和失败路线，不会上传。'),blindTest:p('Five-minute blind play','五分钟盲玩'),legacy:p('A new four-world adventure. Your old twelve-level record is archived.','四世界是一次新冒险，旧版十二关记录已保留。'),deckFull:p('All seed pockets are full. Remove one first.','种子袋已满，先取消一种植物。'),upgrade:p('Bloom','开花进化'),upgradeLocked:p('Grow for forty seconds first.','先护它长大，约需四十秒。'),maxLevel:p('Already in bloom','已经开花了'),tier:p('Growth stage','生长阶段'),score:p('Rating','评级'),pause:p('Pause','暂停'),noSkip:p('Clear the previous garden first.','先守住前一座院子。'),journeyIntro:p('New gardens open in order. Revisit only gardens already cleared.','新院子逐关开放，只能重玩已经通关的院子。'),guideTitle:p('A guide for this stubborn garden','这座倔强院子的指南'),restartBody:p('Reset creates an automatic backup and requires a second confirmation.','重置前自动备份，并需要再次确认。'),trailerFeatures:p('Grow sprouts. Four worlds. Light the last night.','护芽长大 · 四世界冒险 · 照亮最后一夜')
});
root.GardenPages={
index:{title:p('Sprout Patrol — Protect what grows · Jiacheng Ma','萌芽保卫队 — 护芽长大 · 马嘉程'),description:p('Plant fragile sprouts, protect them for forty seconds, then bloom. A four-world garden defense game I independently developed.','种下便宜的幼芽，守护四十秒，再让它开花。我独立开发的四世界草坪防守游戏。')},
codex:{title:p('Plants, visitors and their weaknesses — Sprout Patrol','植物、来客与弱点 — 萌芽保卫队图鉴'),description:p('Meet twenty plants in nine roles and fifteen zombie questions. Discover personalities, weaknesses and combinations.','认识二十种职能植物与十五类僵尸，查看人设、弱点与组合协同，随冒险解锁图鉴。')},
guide:{title:p('Sun, sprouts and the night fog — Sprout Patrol guide','阳光、幼芽与夜雾 — 萌芽保卫队指南'),description:p('Illustrated planting instructions: collect sun, choose a seed, protect two shooters, grow, bloom and light the fog.','图解收阳光、选种子、种两株射手、护芽成长、开花和照亮迷雾，每一步都能直接阅读。')},
about:{title:p('Jiacheng Ma — Author of Sprout Patrol','马嘉程 / Jiacheng Ma — 萌芽保卫队作者'),description:p('I am Jiacheng Ma. Sprout Patrol is my independently developed game project. Contact: 19870043434.','我是马嘉程，《萌芽保卫队》是我独立开发的个人游戏作品。联系方式：19870043434。')},
trailer:{title:p('From morning sprouts to the last night — Sprout Patrol trailer','从清晨萌芽到最后夜战 — 萌芽保卫队预告'),description:p('Watch a four-world game trailer: protect growing plants, weather fast attacks and reveal enemies with lanterns in the night fog.','观看四世界游戏预告：保护幼芽成长，应对快节奏攻势，用灯笼照亮夜雾中的来客。')},
journal:{title:p('Ratings, small upgrades and keepsakes — Sprout Patrol','评级、永久改善与成就 — 萌芽保卫队手记'),description:p('Revisit completed gardens, earn campaign stars, exchange modest upgrades and track eighteen keepsakes.','重玩已通关院子，攒评级星星、兑换有限永久升级，收集十八项花园成就。')},
challenges:{title:p('Endless waves and a daily garden — Sprout Patrol','无尽波次与今日院子 — 萌芽保卫队挑战'),description:p('Try a seeded daily challenge or endless defense. Compare records saved on this device.','挑战每日固定种子与限定植物，或在无尽模式中撑过更多波次，战绩保存在本机。')},
updates:{title:p('What changed in this garden — Sprout Patrol updates','这座院子的新变化 — 萌芽保卫队更新日志'),description:p('Gameplay and accessibility changes in the four-world Sprout Patrol release.','查看四世界版本的玩法、音频、无障碍与存档功能变化。')},
testing:{title:p('Five-minute garden playtest','五分钟花园盲测'),description:p('A five-minute isolated play session, optional recording and local notes for the Sprout Patrol release candidate.','五分钟独立试玩，可选择录屏，记录卡点并导出本地盲测材料。')}
};})(globalThis);

Object.assign(globalThis.GardenPages,{
  "index": {
    "title": {
      "en": "Sprout Patrol — Protect what grows · Jiacheng Ma",
      "zh": "萌芽保卫队 — 护芽长大 · 马嘉程"
    },
    "description": {
      "en": "Plant fragile sprouts, protect them for forty seconds, then bloom. A four-world garden defense game I independently developed.",
      "zh": "种下便宜的幼芽，守护四十秒，再让它开花。我独立开发的四世界草坪防守游戏。"
    }
  },
  "codex": {
    "title": {
      "en": "Plants, visitors and their weaknesses — Sprout Patrol",
      "zh": "植物、来客与弱点 — 萌芽保卫队图鉴"
    },
    "description": {
      "en": "Meet twenty plants in nine roles and fifteen zombie questions. Discover personalities, weaknesses and combinations.",
      "zh": "认识二十种职能植物与十五类僵尸，查看人设、弱点与组合协同，随冒险解锁图鉴。"
    }
  },
  "guide": {
    "title": {
      "en": "Sun, sprouts and the night fog — Sprout Patrol guide",
      "zh": "阳光、幼芽与夜雾 — 萌芽保卫队指南"
    },
    "description": {
      "en": "Illustrated planting instructions: collect sun, choose a seed, protect two shooters, grow, bloom and light the fog.",
      "zh": "图解收阳光、选种子、种两株射手、护芽成长、开花和照亮迷雾，每一步都能直接阅读。"
    }
  },
  "about": {
    "title": {
      "en": "Jiacheng Ma — Author of Sprout Patrol",
      "zh": "马嘉程 / Jiacheng Ma — 萌芽保卫队作者"
    },
    "description": {
      "en": "I am Jiacheng Ma. Sprout Patrol is my independently developed game project. Contact: 19870043434.",
      "zh": "我是马嘉程，《萌芽保卫队》是我独立开发的个人游戏作品。联系方式：19870043434。"
    }
  },
  "trailer": {
    "title": {
      "en": "From morning sprouts to the last night — Sprout Patrol trailer",
      "zh": "从清晨萌芽到最后夜战 — 萌芽保卫队预告"
    },
    "description": {
      "en": "Watch a four-world game trailer: protect growing plants, weather fast attacks and reveal enemies with lanterns in the night fog.",
      "zh": "观看四世界游戏预告：保护幼芽成长，应对快节奏攻势，用灯笼照亮夜雾中的来客。"
    }
  },
  "journal": {
    "title": {
      "en": "Ratings, small upgrades and keepsakes — Sprout Patrol",
      "zh": "评级、永久改善与成就 — 萌芽保卫队手记"
    },
    "description": {
      "en": "Revisit completed gardens, earn campaign stars, exchange modest upgrades and track eighteen keepsakes.",
      "zh": "重玩已通关院子，攒评级星星、兑换有限永久升级，收集十八项花园成就。"
    }
  },
  "challenges": {
    "title": {
      "en": "Endless waves and a daily garden — Sprout Patrol",
      "zh": "无尽波次与今日院子 — 萌芽保卫队挑战"
    },
    "description": {
      "en": "Try a seeded daily challenge or endless defense. Compare records saved on this device.",
      "zh": "挑战每日固定种子与限定植物，或在无尽模式中撑过更多波次，战绩保存在本机。"
    }
  },
  "updates": {
    "title": {
      "en": "What changed in this garden — Sprout Patrol updates",
      "zh": "这座院子的新变化 — 萌芽保卫队更新日志"
    },
    "description": {
      "en": "Gameplay and accessibility changes in the four-world Sprout Patrol release.",
      "zh": "查看四世界版本的玩法、音频、无障碍与存档功能变化。"
    }
  },
  "testing": {
    "title": {
      "en": "Five-minute garden playtest",
      "zh": "五分钟花园盲测"
    },
    "description": {
      "en": "A five-minute isolated play session, optional recording and local notes for the Sprout Patrol release candidate.",
      "zh": "五分钟独立试玩，可选择录屏，记录卡点并导出本地盲测材料。"
    }
  },
  "cloud": {
    "title": {
      "zh": "让院子随你搬家 — 萌芽保卫队",
      "en": "Take the garden with you — Sprout Patrol"
    },
    "description": {
      "zh": "自愿开启匿名设备云存档；保存冲突双方、恢复版本、导出或删除。",
      "en": "Optional anonymous cloud saves with preserved conflicts, version restore, export and deletion."
    }
  },
  "privacy": {
    "title": {
      "zh": "隐私说明 — 萌芽保卫队",
      "en": "Privacy — Sprout Patrol"
    },
    "description": {
      "zh": "云存档与匿名统计默认关闭。查看保存的数据以及如何导出和删除。",
      "en": "Cloud saves and anonymous metrics are off by default. Learn what is stored and how to export or delete it."
    }
  },
  "replay": {
    "title": {
      "zh": "院子里的回声 — 萌芽保卫队",
      "en": "Garden echoes — Sprout Patrol"
    },
    "description": {
      "zh": "在浏览器重播经过验证的每日院子，不含作者个人信息。",
      "en": "Replay a verified daily garden in your browser, without creator personal information."
    }
  },
  "press": {
    "title": {
      "zh": "这座倔强院子 — 萌芽保卫队",
      "en": "The stubborn garden — Sprout Patrol"
    },
    "description": {
      "zh": "我为《萌芽保卫队》整理的宣传片、游戏截图与分享素材。",
      "en": "The trailer, screenshots and sharing materials I prepared for Sprout Patrol."
    }
  },
  "home": {
    "title": {
      "zh": "我的院子 — 萌芽保卫队",
      "en": "My garden — Sprout Patrol"
    },
    "description": {
      "zh": "让星星变成摆件：布置自己的院子，保存照片，外观不加战斗数值。",
      "en": "Turn stars into ornaments, arrange your garden and save a photo. Cosmetics do not change combat stats."
    }
  }
});
// Short, task-oriented labels for the battle interface.
Object.assign(globalThis.GardenCopy,{
 growthPromise:{zh:'种下萌芽，守护成长。',en:'Plant a sprout. Protect its growth.'},
 quickSun:{zh:'收集阳光，种下太阳芽。',en:'Collect sun and plant a Sunbud.'},
 quickPlant:{zh:'在开放路线种下射手。',en:'Place shooters in the open lanes.'},
 quickGrow:{zh:'护住幼芽，40 秒后长成成株。',en:'Protect sprouts for 40 seconds to mature.'},
 lostProtect:{zh:'需要保护的植物被摧毁了。',en:'The protected plant was destroyed.'},
 lostTime:{zh:'本关用时已达到上限。',en:'The garden time limit was reached.'},
 resultTools:{zh:'分享与回看',en:'Share and review'},
 squadSelected:{zh:'已选择',en:'Selected'},
 squadTools:{zh:'保存或导入阵容',en:'Save or import a squad'},
 start:{zh:'开始这一关',en:'Start this garden'},
 retry:{zh:'重新挑战',en:'Try again'},
 squad:{zh:'选择植物',en:'Choose plants'},
 pausedBody:{zh:'战斗已暂停，进度已保存在本机。',en:'The battle is paused and saved on this device.'},
 assistance:{zh:'试试另一种策略',en:'Try a different strategy'},
 assistBody:{zh:'这一关已连续失利三次。可以调整阵容，或选择更轻松的难度。',en:'Three attempts have ended here. Adjust your squad or try an easier difficulty.'},
 guideTitle:{zh:'游戏指南',en:'Game guide'}
});
