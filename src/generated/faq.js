// GENERATED FILE - do not edit.
//
// Written by scripts/build-faq.mjs from FAQ.md. Edit FAQ.md and the next build
// (or `npm run faq`) regenerates this. `npm run verify` fails if the two have
// drifted, so a stale copy cannot reach a user.
//
// 9 sections, 47 questions.
export const FAQ = {
  "title": "Cadence — the short answers",
  "intro": [
    {
      "type": "p",
      "body": [
        "Everything people actually ask, with the real numbers rather than reassuring adjectives. If you only read one section, read ",
        {
          "b": "Your data lives on your phone and nowhere else"
        },
        ". If you are deciding whether to trust it at all, read ",
        {
          "b": "Is it safe to install?"
        },
        "."
      ]
    }
  ],
  "sections": [
    {
      "heading": "The basics",
      "lead": [],
      "items": [
        {
          "q": "What does it actually do?",
          "body": [
            {
              "type": "p",
              "body": [
                "Asks one question a day — ",
                {
                  "i": "what did you spend?"
                },
                " — and answers one back: ",
                {
                  "i": "what can you spend today?"
                },
                " It divides your discretionary money for the pay period across the days you have left, and it re-does that sum every time you log something."
              ]
            }
          ]
        },
        {
          "q": "Is it free?",
          "body": [
            {
              "type": "p",
              "body": "Yes. No account, no subscription, no ads, nothing to sign up for."
            }
          ]
        },
        {
          "q": "Does it connect to my bank?",
          "body": [
            {
              "type": "p",
              "body": "No. There is nothing to connect. You type in what you spent."
            }
          ]
        },
        {
          "q": "Does it track categories, cents, or receipts?",
          "body": [
            {
              "type": "p",
              "body": "No. Whole dollars, one number a day. That is the whole design — a budget you have to think about is a budget you abandon."
            }
          ]
        },
        {
          "q": "Do I need the internet?",
          "body": [
            {
              "type": "p",
              "body": "Only for the very first load. After that it runs entirely offline, including on a plane or with no signal."
            }
          ]
        },
        {
          "q": "Which currency?",
          "body": [
            {
              "type": "p",
              "body": [
                "Dollars, hardcoded. There is no currency setting, and the ",
                {
                  "c": "$"
                },
                " will show whatever country you are in."
              ]
            }
          ]
        }
      ]
    },
    {
      "heading": "Your data lives on your phone and nowhere else",
      "lead": [],
      "items": [
        {
          "q": "Where is my data stored?",
          "body": [
            {
              "type": "p",
              "body": [
                "In your browser's own storage on that device, under the key ",
                {
                  "c": "budgetHabitTracker.v1"
                },
                ". That is the only copy that exists."
              ]
            }
          ]
        },
        {
          "q": "Does anything get sent anywhere?",
          "body": [
            {
              "type": "p",
              "body": "No. There is no server, no account, no analytics, no telemetry. Nobody — including whoever built this — can see what you spend. That is not a privacy policy, it is just how it is built: there is nothing on the other end to send it to."
            }
          ]
        },
        {
          "q": "How much space does it use?",
          "body": [
            {
              "type": "table",
              "head": [
                "History",
                "Stored size"
              ],
              "rows": [
                [
                  "One year, logged every day",
                  [
                    "about ",
                    {
                      "b": "15 KB"
                    }
                  ]
                ],
                [
                  "Five years",
                  [
                    "about ",
                    {
                      "b": "75 KB"
                    }
                  ]
                ],
                [
                  "Ten years",
                  [
                    "about ",
                    {
                      "b": "150 KB"
                    }
                  ]
                ]
              ]
            },
            {
              "type": "p",
              "body": "For scale, one photo from your phone is roughly 3,000 KB. You will never run out of room for this."
            }
          ]
        },
        {
          "q": "Will the browser ever delete it on its own?",
          "body": [
            {
              "type": "p",
              "body": [
                "It can. Browsers treat ordinary website storage as disposable and may clear it when the device runs low on space. Cadence asks the browser to mark its storage as ",
                {
                  "i": "persistent"
                },
                ", which exempts it from that — and ",
                {
                  "b": "installing to your home screen is what makes browsers say yes."
                },
                " Check the answer any time under ",
                {
                  "b": "Settings → Backup"
                },
                "."
              ]
            }
          ]
        },
        {
          "q": "What definitely erases it?",
          "body": [
            {
              "type": "list",
              "items": [
                "Clearing site data or \"browsing data\" for the site",
                "Uninstalling the app from your home screen",
                "Using a private / incognito window (it is gone the moment you close it)",
                "Switching to a different browser on the same phone — each one has its own separate storage"
              ]
            }
          ]
        },
        {
          "q": "So what is my safety net?",
          "body": [
            {
              "type": "p",
              "body": [
                {
                  "b": "Settings → EXPORT BACKUP."
                },
                " It saves a small ",
                {
                  "c": "cadence-backup-YYYY-MM-DD.json"
                },
                " file with every period and every logged day in it. Put it somewhere that isn't the phone — email it to yourself, drop it in cloud storage. Import it on any device to restore. It is also offered at the end of each period, which is the natural moment to take one."
              ]
            }
          ]
        },
        {
          "q": "Can I read the backup file?",
          "body": [
            {
              "type": "p",
              "body": "Yes, it's plain text JSON. You can open it in any text editor. Import is deliberately strict, though — a file that has been edited into an invalid shape gets refused at the door with a reason, rather than half-loaded."
            }
          ]
        }
      ]
    },
    {
      "heading": "Is it safe to install?",
      "lead": [],
      "items": [
        {
          "q": "Can it damage my phone?",
          "body": [
            {
              "type": "p",
              "body": "No. Cadence is a web page, and web pages run inside a sandbox enforced by your browser — by Apple, Google and Mozilla, not by us. Nothing on a web page can damage hardware, change your operating system settings, reach another app's data, or touch your files. That holds even if the app has a bug in it."
            }
          ]
        },
        {
          "q": "Installing it to my home screen doesn't change that?",
          "body": [
            {
              "type": "p",
              "body": "No. What gets installed is the same sandboxed page, just without the browser's address bar around it. It is not a native app and it gains no new powers by being installed."
            }
          ]
        },
        {
          "q": "What permissions does it ask for?",
          "body": [
            {
              "type": "p",
              "body": [
                "None. No camera, no microphone, no location, no contacts, no photos, no notifications. The only thing it ever asks the browser is ",
                {
                  "i": "please don't delete my storage"
                },
                " — and on Firefox that appears as a prompt you can decline."
              ]
            }
          ]
        },
        {
          "q": "Can my spending data get out?",
          "body": [
            {
              "type": "p",
              "body": "There is no code in the app that contacts a network, so there is no channel for it to leave by. Not \"we promise not to\" — there is no send function to misuse. The only way data moves off your device is the backup file you export yourself."
            }
          ]
        },
        {
          "q": "Can I check that rather than take your word for it?",
          "body": [
            {
              "type": "p",
              "body": [
                "Yes, and it takes about a minute. Open the app on a computer, press ",
                {
                  "b": "F12"
                },
                ", click the ",
                {
                  "b": "Network"
                },
                " tab, then use it — log a spend, change the theme, open Settings. You will see the files load once and then nothing further. No rows means nothing is being sent."
              ]
            }
          ]
        },
        {
          "q": "Are there hidden trackers or ads?",
          "body": [
            {
              "type": "p",
              "body": "No analytics, no advertising, no third-party scripts of any kind. The font is served from the app itself rather than pulled from Google, so even loading the page tells nobody anything."
            }
          ]
        },
        {
          "q": "So what is the worst that could realistically happen?",
          "body": [
            {
              "type": "p",
              "body": [
                "Your Cadence history gets corrupted or lost, or a daily limit comes out wrong. The first is why ",
                {
                  "b": "EXPORT BACKUP"
                },
                " exists and why the app warns you rather than quietly starting over. The second is what the 300 automated checks that run before every single update are there to catch. Neither one reaches anything else on your phone."
              ]
            }
          ]
        },
        {
          "q": "Who made this and is it supported?",
          "body": [
            {
              "type": "p",
              "body": "One person, as a personal project, given away free under an MIT licence — which like nearly all free software comes with no warranty. It is offered in good faith and used at your own discretion. Keep a backup, which is good advice for anything you would be annoyed to lose."
            }
          ]
        }
      ]
    },
    {
      "heading": "Two phones, new phones, shared phones",
      "lead": [],
      "items": [
        {
          "q": "Does it sync between my phone and my laptop?",
          "body": [
            {
              "type": "p",
              "body": "No. There is no sync because there is no server. Each device keeps its own independent history."
            }
          ]
        },
        {
          "q": "How do I move to a new phone?",
          "body": [
            {
              "type": "p",
              "body": [
                "Export a backup on the old one, install Cadence on the new one, then ",
                {
                  "b": "Settings → IMPORT BACKUP"
                },
                ". Importing ",
                {
                  "i": "replaces"
                },
                " everything on the new device, so do it before you start logging there."
              ]
            }
          ]
        },
        {
          "q": "I installed it to my home screen but my data isn't there.",
          "body": [
            {
              "type": "p",
              "body": "Expected, and it catches everyone. The browser and the installed app are treated as two separate places, so anything logged while browsing does not appear in the installed copy. Export from the browser, import into the app."
            },
            {
              "type": "p",
              "body": [
                {
                  "b": "Best practice:"
                },
                " install first, then start logging."
              ]
            }
          ]
        }
      ]
    },
    {
      "heading": "How big is it?",
      "lead": [
        {
          "type": "p",
          "body": [
            {
              "b": "Download, first time:"
            },
            " about ",
            {
              "b": "320 KB"
            },
            " of files, of which roughly ",
            {
              "b": "160 KB"
            },
            " actually crosses the network once compressed. That is a fraction of a single web page these days."
          ]
        },
        {
          "type": "table",
          "head": [
            "Piece",
            "Size"
          ],
          "rows": [
            [
              "The app itself (JavaScript)",
              "201 KB → 64 KB compressed"
            ],
            [
              "Styling",
              "22 KB → 5 KB compressed"
            ],
            [
              "JetBrains Mono font, 3 weights",
              "63 KB"
            ],
            [
              "Icons",
              "25 KB"
            ]
          ]
        },
        {
          "type": "p",
          "body": [
            {
              "b": "After that:"
            },
            " zero. It is cached on the device and loads instantly with no network at all."
          ]
        },
        {
          "type": "p",
          "body": [
            {
              "b": "Installed size on the phone:"
            },
            " the files above plus your history, so well under half a megabyte in total for years of use."
          ]
        }
      ],
      "items": []
    },
    {
      "heading": "Installing it",
      "lead": [
        {
          "type": "p",
          "body": [
            "You need the ",
            {
              "b": "HTTPS address"
            },
            ", not a local network one. A plain ",
            {
              "c": "http://"
            },
            " address will load the app fine but will never offer a real install."
          ]
        },
        {
          "type": "table",
          "head": [
            "Phone",
            "How"
          ],
          "rows": [
            [
              [
                {
                  "b": "Android, Chrome"
                }
              ],
              [
                "⋮ menu → ",
                {
                  "b": "Install app"
                }
              ]
            ],
            [
              [
                {
                  "b": "Android, Firefox"
                }
              ],
              [
                "⋮ menu → ",
                {
                  "b": "Install"
                },
                " (older builds: ",
                {
                  "i": "Add to Home screen"
                },
                ")"
              ]
            ],
            [
              [
                {
                  "b": "iPhone, Safari"
                }
              ],
              [
                "Share → ",
                {
                  "b": "Add to Home Screen"
                }
              ]
            ],
            [
              [
                {
                  "b": "iPhone, other browsers"
                }
              ],
              "Use Safari. Firefox and Chrome on iOS are Safari underneath anyway, and Safari is the route that reliably works."
            ]
          ]
        }
      ],
      "items": [
        {
          "q": "Why bother installing rather than bookmarking?",
          "body": [
            {
              "type": "p",
              "body": "Three things change: it opens full-screen with no browser chrome, it gets a real icon in your app drawer, and — the important one — the browser stops treating your history as disposable."
            }
          ]
        },
        {
          "q": "Firefox asks me for permission to store data.",
          "body": [
            {
              "type": "p",
              "body": [
                "Say yes. Firefox prompts out loud about persistent storage where Chrome decides silently. It appears once you create your first period, and accepting is what keeps your history out of the browser's automatic cleanup. If you dismissed it, ",
                {
                  "b": "Settings → Backup"
                },
                " has a ",
                {
                  "b": "CHECK AGAIN"
                },
                " button."
              ]
            }
          ]
        }
      ]
    },
    {
      "heading": "Updates",
      "lead": [],
      "items": [
        {
          "q": "How does the app update?",
          "body": [
            {
              "type": "p",
              "body": "By itself. Next time you open it with a working connection it picks up the latest version. There is no app store, nothing to approve, and no version number to check."
            }
          ]
        },
        {
          "q": "Will an update wipe my data?",
          "body": [
            {
              "type": "p",
              "body": "No. Your history is stored separately from the app's code and survives every update."
            }
          ]
        },
        {
          "q": "Does it break if I open it while an update is happening?",
          "body": [
            {
              "type": "p",
              "body": "No. It waits three seconds for the network, and if it doesn't get a good answer it opens the copy already on the phone. A slow connection, no connection, or a server error mid-deploy all end up at the same place: the app opens."
            }
          ]
        },
        {
          "q": "I updated and it looks the same / looks wrong.",
          "body": [
            {
              "type": "p",
              "body": [
                "Close it completely and reopen. On a desktop browser, hard refresh with ",
                {
                  "b": "Ctrl+Shift+R"
                },
                "."
              ]
            }
          ]
        }
      ]
    },
    {
      "heading": "Using it day to day",
      "lead": [],
      "items": [
        {
          "q": "What if I forget to log a day?",
          "body": [
            {
              "type": "p",
              "body": [
                "Nothing bad. A day you never logged is ",
                {
                  "i": "unknown"
                },
                ", not zero, and it never inflates or deflates your limit — its share of money simply stays in the pool for whichever day you log next. $500 over 14 days stays about $36/day even after a gap."
              ]
            }
          ]
        },
        {
          "q": "Can I go back and fill in yesterday?",
          "body": [
            {
              "type": "p",
              "body": "Yes. Tap any past day in the list and log it there. Everything after it recalculates automatically."
            }
          ]
        },
        {
          "q": "Can I log tomorrow in advance?",
          "body": [
            {
              "type": "p",
              "body": "No. Future days are refused deliberately — the app only ever records time you have actually lived through."
            }
          ]
        },
        {
          "q": "What if I spend nothing?",
          "body": [
            {
              "type": "p",
              "body": [
                "Log ",
                {
                  "b": "$0"
                },
                ". That is a tracked day and it counts. It is different from ignoring the day, and the app treats them differently."
              ]
            }
          ]
        },
        {
          "q": "What happens if I go over?",
          "body": [
            {
              "type": "p",
              "body": "The bar refills backwards from zero in red, and tomorrow's limit drops to absorb it. Your daily limit never goes negative — it floors at $0 and the debt shows up under REMAINING instead."
            }
          ]
        },
        {
          "q": "What happens when a period ends?",
          "body": [
            {
              "type": "p",
              "body": "You get a summary of how it went, an offer to save a backup, and the next period is set up for you based on your pay cadence."
            }
          ]
        },
        {
          "q": "Can I see that summary again later?",
          "body": [
            {
              "type": "p",
              "body": [
                "Yes. Every period's day list ends with a ",
                {
                  "b": "REPORT CARD"
                },
                " row — the current period and every finished one. Swipe back to a period, or tap its bar in Trends, then scroll to the bottom of the days and tap it."
              ]
            }
          ]
        },
        {
          "q": "Can I save a report card as a picture?",
          "body": [
            {
              "type": "p",
              "body": [
                "Yes. Open it and tap ",
                {
                  "b": "SAVE AS IMAGE"
                },
                ". Your phone's share sheet opens, so it can go straight to Photos, Drive, a message, or an email; if sharing is not available it saves to your downloads instead. The image is drawn fresh rather than screenshotted, so it looks the same everywhere and uses whichever theme you have on."
              ]
            }
          ]
        },
        {
          "q": "I was away for a week and haven't opened it.",
          "body": [
            {
              "type": "p",
              "body": "It notices. A gap of three days or more gets acknowledged rather than silently papered over, and it helps you start fresh."
            }
          ]
        },
        {
          "q": "How do I change how often I get paid?",
          "body": [
            {
              "type": "p",
              "body": [
                {
                  "b": "Settings → Pay Cadence."
                },
                " Weekly, every two weeks (26/yr), twice a month (24/yr), monthly, or set your own dates each time."
              ]
            },
            {
              "type": "p",
              "body": [
                "Note that \"every two weeks\" and \"twice a month\" are not the same schedule — 26 pay periods against 24, and only one of them can be right for you. Every two weeks keeps the same ",
                {
                  "i": "weekday"
                },
                " and lets the date wander; twice a month keeps the same ",
                {
                  "i": "dates"
                },
                " and lets the weekday wander."
              ]
            },
            {
              "type": "p",
              "body": "If you are paid twice a month, just enter either one of your two paydays and it works out the other. The 1st and 16th, the 5th and 20th, the 15th and the last day of the month — all handled, and the last day of the month follows February without you having to fix it."
            }
          ]
        },
        {
          "q": "How do I change my budget mid-period?",
          "body": [
            {
              "type": "p",
              "body": [
                {
                  "b": "Settings → Edit Current Period"
                },
                " changes the amount and the end date. Every daily limit recalculates. If shrinking the period would hide days you already logged, it asks first — and those days come back if you widen it again."
              ]
            }
          ]
        },
        {
          "q": "What does \"Abandon Current Period\" do?",
          "body": [
            {
              "type": "p",
              "body": "Ends the current period today and starts the next one tomorrow. It is an escape hatch for a period set up wrong, not something you need in normal use."
            }
          ]
        },
        {
          "q": "Can I change how it looks?",
          "body": [
            {
              "type": "p",
              "body": [
                {
                  "b": "Settings → Theme."
                },
                " Three palettes, darkest to lightest: Tokyo Night (deep indigo), Slate (neutral grey), Catppuccin Latte (light). Applies instantly, and your choice survives closing the app."
              ]
            }
          ]
        }
      ]
    },
    {
      "heading": "When something goes wrong",
      "lead": [],
      "items": [
        {
          "q": "A warning banner about storage appeared.",
          "body": [
            {
              "type": "p",
              "body": "Two different things it might mean:"
            },
            {
              "type": "list",
              "items": [
                [
                  {
                    "b": "NOT SAVING"
                  },
                  " — writes are failing (storage full, or a private window). Nothing logged since it appeared will survive closing the tab. Free up space, and export a backup if it will let you."
                ],
                [
                  {
                    "b": "COULD NOT READ SAVED DATA"
                  },
                  " — what was stored couldn't be understood, so the app started empty. ",
                  {
                    "b": "Don't log anything yet."
                  },
                  " The old data may still be there, and Cadence deliberately avoids overwriting it — but starting a new period will."
                ]
              ]
            }
          ]
        },
        {
          "q": "My history vanished and it's showing me the setup screen.",
          "body": [
            {
              "type": "p",
              "body": "Something cleared the site's storage. If you have a backup file, import it. If not, it is gone — there is no server copy to recover. This is the reason export exists, and the reason to keep one somewhere off the phone."
            }
          ]
        },
        {
          "q": "Blank screen when I open it.",
          "body": [
            {
              "type": "p",
              "body": "Close it fully and reopen. If it persists, open the same address in a normal browser tab to check the site itself is up."
            }
          ]
        },
        {
          "q": "It won't offer to install.",
          "body": [
            {
              "type": "p",
              "body": [
                "You are almost certainly on an ",
                {
                  "c": "http://"
                },
                " address. Installing requires HTTPS."
              ]
            },
            {
              "type": "p",
              "body": [
                {
                  "i": "For running the project or building it yourself, see `HOW-TO-RUN.md` and `README.md`."
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
