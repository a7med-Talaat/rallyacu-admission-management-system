/**
 * RALLY ACU - CRYPTOGRAPHIC AUTHENTICATION ENGINE
 * Fixed authentication without external database.
 * Emails and passwords are stored as cryptographic SHA-256 salted hashes
 * and AES-GCM encrypted profiles. No plaintext credentials exist in source code.
 */

(function () {
  // Salty hashes and encrypted payloads derived cryptographically
  const CREDENTIAL_STORE = [
    {
      id: "head_media",
      salt: "7b3f8e4140ae6092f55b0aa401906add",
      emailHash: "75ecd72b62cc655379e0c236d71841f2b4847b3b2942704671825e86003acdc1",
      passHashes: [
        "7b96c99d059749422f8c119de7f5a0d60516d053e39dcf71108d104afa8339f5"
      ],
      encryptedProfile: {
        iv: "846ab152fd72d49df3cd4919",
        tag: "a20c94d41b55f305e394fb82d375cea2",
        data: "e52366588f7484ec2f39a520447817cd60231c0e1091b24bf957cd2331e8ee4714f3f96d32573d550a745c64f05a8fcc7b6a03b839f82cbbe3ea7da5f8a42263ed950dfe6fc0bb18906d5cf1c527394aba8c562f15a1bee00c4f419e"
      },
      fallback: {
        name: "Ahmed Talaat",
        committee: "Media",
        role: "Head of Media",
        badge: "Media Lead",
        isAdmin: false
      }
    },
    {
      id: "head_entrepreneur",
      salt: "7d371da6aa2efc5dae9f6e8cae96c1d7",
      emailHash: "73979cf4d3aa9c4b508ae6b11cc2f1f3b0e4bdb91409749fc7e15c77e69c4dc6",
      passHashes: [
        "4199a7882621f23ffc6a03b9f357fdd78138b52445a937ef865bb88ff397769a"
      ],
      encryptedProfile: {
        iv: "d4321036df19062f8da3f00b",
        tag: "de1914538ac4c1f42da007d26b7843a3",
        data: "1eb79051e101f491d5ea8317a84464adf1ca2a1c4fc42841f554ba437437c2e3f3e18258523e4ff72631b6bba138682eeb0be425bd083a89b24124b4d05fa95912983309a62d526f479b6b0b0eff42216766a3b967bf3976df3e288c9916eb37fc4178fe5199e8"
      },
      fallback: {
        name: "Mohamed Khaled",
        committee: "Entrepreneur",
        role: "Head of Entrepreneur",
        badge: "Entrepreneur Lead",
        isAdmin: false
      }
    },
    {
      id: "head_operation",
      salt: "c30d4537ca888cd9ffedee10d1da2acc",
      emailHash: "3317fa17f596bc24a9a9b56d6035b3cb7240be92a350c2e8bf7a3436c34ea0de",
      passHashes: [
        "237422ebc1dc49700684ea572eb1ff057a9d501662f3645d1f3beb1ce2039326",
        "3c2bef2a85c65f325e6e5631ad258e34fb9c7009550b2fa2ff16c4ee05bd84f9"
      ],
      encryptedProfile: {
        iv: "a57014f67dee5e743f8f4d1d",
        tag: "6d27c09e5b43eccd2e9d4a4406edac0a",
        data: "360f3fa3b1e636471dacdfbb6e592afa5d3566d5d23467371f483200aaed2e25eb96e2cc3f183b2e6908f370bb8ef47fefab4a78add5c8ecd9f0e091712cd713b1aa3a2497db9187d1e53d148c93cb6f6c3ad2fa269555a110546a7b"
      },
      fallback: {
        name: "Arwa Ahmed",
        committee: "Operation",
        role: "Head of Operation",
        badge: "Operation Lead",
        isAdmin: false
      }
    },
    {
      id: "admin_tm",
      salt: "4757bdc9f024a10c95ae0844e57d7a03",
      emailHash: "e2adc7c4be9471925c61e3b625acedd2cc6055e7bdd4a6f9d24bc9df83dca038",
      passHashes: [
        "01ae06b9b98f06c837a20d18bdc43116a66179752b70db4acc9aa3f028492449",
        "100b7c1890200f55e521ae65a15d45f7967f574c727e196dd0f02d0cfc0a9552"
      ],
      encryptedProfile: {
        iv: "3df45fc638b052877ad50204",
        tag: "a2d17aaaf0310c46409b1787bdb47414",
        data: "d2c4f5029e411fd84a9c70547a4fe498803ff419f218be4609926eb183e998bf4c5a48f8ea3e297501f113154d8b87722b6cee191a109eb879424d89bdb8dd6b41534fe8e685433f07a98047dba98d1e3d0d499f9f47ff57ee7ac96bb3d20e57e276ae30d176c2d4f3"
      },
      fallback: {
        name: "Mariam Ahmed",
        committee: "Talent Management",
        allowedCommittees: ["Talent Management"],
        role: "Talent Management Lead",
        badge: "Talent Management Lead",
        isAdmin: false
      }
    },
    {
      id: "head_bd",
      salt: "d94d71b94a6af91fd04a92fc67ee5b92",
      emailHash: "132fc38204ae7ce71281297d59fe3628553d7b5c62cb349357072f41b98e5f97",
      passHashes: [
        "75d19e1ece1fc397b5a1d4bac9184b2cc4d42b1c36d257da39f6b5073bb3ab9f",
        "fc93c103e5400875d1dd262b5e8a79abe4446e3f0c319e456e2a953d73b743c5"
      ],
      encryptedProfile: {
        iv: "ac26d01670e02835de8933fa",
        tag: "4f8cdfd9f6ad897bbea1f41cb84a24a2",
        data: "7e187213e97afcadacc0d21db47676bf5d2adfb799e7fc843e111009247d661c9eb2680358952393e6b27c81eee454efffba980eba70aebc69a6d4a28402c1084164cd828efe8730da28a407d6a0b5c1266b9d8afba3a81c688935ee03514b3e58cc"
      },
      fallback: {
        name: "Habiba",
        committee: "Business Development",
        allowedCommittees: ["Business Development"],
        role: "Head of BD",
        badge: "BD Lead",
        isAdmin: false
      }
    },
    {
      id: "lead_bahr",
      salt: "d9722cd82c09af9e37701c82c2894fc2",
      emailHash: "f142ce151d2ebe31ee287a79b68fd4e46d27bc8a65a45a4ada2289d5d2888e6a",
      passHashes: [
        "e9464f308ecf8f9e0228547ca011682957a50eadd83432864ea11e28dedf6077"
      ],
      encryptedProfile: {
        iv: "f7eee3cc128cae2b52a749cd",
        tag: "3e31d32d4794825475804222013f4ab0",
        data: "9e83c2dadefce8320c2dc84477a80f7a4bb02239560fd7aefda9e4d442232729fa5f2fda76ffdb462a5181f65fbcac4c2f860a4f178b4c399a79217f8eb5597ac40d2aa120ad64d53d9c83020921e9033c4c2827826294b31098ae8a564425d8fa9f10884f98a8a14d002632a1bb2cd07318097b927a2c13803fd8351b520bdcad176e08aea75b4478cd0c49e46448824fb2663d162f01ebb939ebdcab3b814ae231045205ccb97d1092c3f428a976829077737df5"
      },
      fallback: {
        name: "Bahr",
        committee: "Operation & Talent Management",
        allowedCommittees: [
          "Operation",
          "Talent Management"
        ],
        role: "HR Operation Lead",
        badge: "Operation + HR",
        isAdmin: false
      }
    },
    {
      id: "tm_boda",
      salt: "996c6ccf2170874519c11d016676e50d",
      emailHash: "373323fc142c5e4fecaa10a045ceba19f269e7cdc88ec1d48dd701c526c04e68",
      passHashes: [
        "26ddcf81a47d02bda0e451ca323dba8e08b1d60c90494d22c366778a9bb5b52c"
      ],
      encryptedProfile: {
        iv: "3644db566b905438e33bc2d6",
        tag: "285dfcd69eef98af93c65c322fd4a34a",
        data: "21de1927ee55d12a27ce81115eee61ad927f13488b1bbd4d95b8b24a44cd7b3f1fce0f256d498c216222f13856ab5577c7d151b99effde930fd054e12d335f785b559e8198afe1ed6b55665523eb764253f08f90b2aeb4bf0f4a4b40520fbe79969b6aab91bc4ef899f5ebcf50aecfc04e55bfd11cd3d468ce0191dffbabf3db20f93000d32fe936bbd58ce28d2f8bde481122ce712abd4b23b60bb8395ba55c8cb31db70f"
      },
      fallback: {
        name: "Boda",
        committee: "Talent Management",
        allowedCommittees: [
          "Talent Management"
        ],
        role: "Head of Talent Management",
        badge: "Head of Talent Management",
        isAdmin: false
      }
    },
    {
      id: "tm_omar",
      salt: "fad8129922c009282d16430eb6116628",
      emailHash: "225b46e1eda5cfaaeec664547ef17b2efe654e349c69e139a7a69ea190a24a30",
      passHashes: [
        "f0a14f473d4d27cd7f0b5f761919651c1c3c7eb03dd9798a5c950897fa84cb0c"
      ],
      encryptedProfile: {
        iv: "6c5f8f77a0a057da253459ba",
        tag: "921a3c471fd6d83ae9e28872beb62196",
        data: "8d4eae38b7de51351bff7a6034bf117d13e2794effa75277b66e6a4f882378040cf10840d1700c9cb3272e8f95a9e06c0219b76b6b0f8f0f8109c52f08280980ab90fa2d4d68a1dd660d3c245b337b6b834ae6feb9ca619ca4919e4381fec3b2c7cb8252c7ecda9b480baa5423fc13305ab28003d9863b98ad63b54b5d3af02dcd8b44d63870d73897ff1e87d334a48cb1531bd89cbbcba178aa9284e573bdd5c8bd711cb8"
      },
      fallback: {
        name: "Omar",
        committee: "Talent Management",
        allowedCommittees: [
          "Talent Management"
        ],
        role: "Talent Management Lead",
        badge: "Talent Management",
        isAdmin: false
      }
    },
    {
      id: "entre_alaa",
      salt: "e87b1e076b3d570285a5e91106e924c5",
      emailHash: "7ade51d11fad89f534458090e577c38049fc129bec5422431c407f40d8f1c199",
      passHashes: [
        "7b396cda7a488182c13f0249e6480b49b9b90907be8f4f4991b22377e37cc7ae"
      ],
      encryptedProfile: {
        iv: "cd71c8042ec1b6b693d8b671",
        tag: "63c517a338def40cd8a3059d5aa4cd25",
        data: "013bf5126887bd57d9b7ea74b4ce96595a8399d14a00efa67972e3b5412a1e51c59b5417674689ec1fd47392513f3b37c27bb91fca0c249c2c6e38d254ae6dded1d6594f485271f876e388067df7a2a5d6e5d6de69ba02040cbd9ab2f62a99183215f05469bd368dc349f98e36390c75de1e48f1d7fab15bebc2c037e1972dc8fd0d39b4e9713a51fbbcd6a1f9fcfe53e4"
      },
      fallback: {
        name: "Alaa",
        committee: "Entrepreneur",
        allowedCommittees: ["Entrepreneur"],
        role: "Entrepreneur Lead",
        badge: "Entrepreneur",
        isAdmin: false
      }
    },
    {
      id: "media_bassant",
      salt: "37f792b3dc88b54879fcf77fed991229",
      emailHash: "c07315077cb2e1838303a82ab21d6eda6ce18150b5a58ebaa501b672a1ee7251",
      passHashes: [
        "48a9d462ea97bc4177319ace28c059811673c9048effd46d4347303d91e1e647"
      ],
      encryptedProfile: {
        iv: "6e4c528a44ff9ca878ec3b90",
        tag: "db65fb93545c230087ad3ae9fa1a1788",
        data: "6bf22191ee80a1173364bbeff0944331c68fbd792bb5c17a01ba489489fb97366f5809ec9e8e591c01a3d6f868347a2525dd35bf0343fb755303bc11e568dcb1a8980ad9a9796f4fdf91f8f5655c9b2d30e804ff9c40dfae870db5cfd6e970cc4d986d012fead2458794e06e80c5198916f513de9723508005a4af465ab8"
      },
      fallback: {
        name: "Bassant Kamal",
        committee: "Media",
        allowedCommittees: ["Media"],
        role: "Media Lead",
        badge: "Media",
        isAdmin: false
      }
    },
    {
      id: "media_roaa",
      salt: "68c532e76b8aa34288eef35bb642fd71",
      emailHash: "c56ceb80735e1eb22653146b253c0b5ce216e0284658c53a3af0f8af10e02ec8",
      passHashes: [
        "56dd52a9545c0bc9e494fc9373420a335718c74c05adc906d79d15a339518079"
      ],
      encryptedProfile: {
        iv: "fadabe779136aca37880df0b",
        tag: "148655bebdf95a77293335be3971680e",
        data: "4c593fcec2e7adc63ee28fc86f39bf325299b2736c67473f516f9eff3d820c5acd6704f640413d7906e1232bf97dd8b795abce3a796bc3e8cb64fb6dd9bc99eac737caef3898a45b31e839429f3ea3f22c645e40954e2cb6000cedb38b9bd137ab9b2596dc08bdb23df4f59a15e98dbe014bdacbfbaae2ee211ef2"
      },
      fallback: {
        name: "Roaa Hatem",
        committee: "Media",
        allowedCommittees: ["Media"],
        role: "Media Lead",
        badge: "Media",
        isAdmin: false
      }
    },
    {
      id: "pres_malak",
      salt: "ef75bbb416e250e7a7b9a91b9a68e9ca",
      emailHash: "b72ca31c7a5137fc8b2667c54f0087504d7f68f70af10d22016f8f9e55dae097",
      passHashes: [
        "2fc8608fc184df905a194e338ed4798fbd3fc2f6e7a9851eef6996a353eef4c6"
      ],
      encryptedProfile: {
        iv: "bb2e998ce3e7c3928f897453",
        tag: "28740b54d973f2ebeb49b9f0679c388b",
        data: "5cef01acccc72a06f1f08e306a42eef6c6f7df80e417c731bb0c3a3dc3e2f5cfa16605bea4bab587aaff08873b315f42755ee5797879bac97e95de4a0c268fd1b96a52caf776c659cdea37f502f3b9a80d93e63b8bd363c508456a8bfb7b5d8be101009d2d957897d67f3d6d481b37af1195bfbe59e2df97f77515a546bcf8aea57b9ee63c74a16a1a6674a477610b90449fcf5a91fb1bb0ee28a4a35d616a59356371dbc1c3376a07dd60c86b53ce1784ece9379ad1e2e584b686d13e18d2d375182081814d481dc1278b6dec4e70ae800ddba8e5f27fff028db469"
      },
      fallback: {
        name: "Malak Hussein",
        committee: "All Committees",
        allowedCommittees: [
          "Media",
          "Entrepreneur",
          "Operation",
          "Business Development",
          "Talent Management"
        ],
        role: "President of Rally ACU",
        badge: "President",
        isAdmin: true
      }
    }
  ];

  // Helper: SHA-256 calculation in browser WebCrypto
  async function computeSha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Helper: hex to Uint8Array
  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  // Attempt WebCrypto AES-GCM Decryption
  async function decryptProfile(keyStr, encObj) {
    try {
      const encoder = new TextEncoder();
      const rawKey = await crypto.subtle.digest("SHA-256", encoder.encode(keyStr));
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const iv = hexToBytes(encObj.iv);
      const tag = hexToBytes(encObj.tag);
      const data = hexToBytes(encObj.data);

      // Concatenate ciphertext and tag for WebCrypto
      const combined = new Uint8Array(data.length + tag.length);
      combined.set(data, 0);
      combined.set(tag, data.length);

      const decryptedBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        combined
      );

      const decStr = new TextDecoder().decode(decryptedBuf);
      return JSON.parse(decStr);
    } catch (e) {
      return null;
    }
  }

  window.RallyAuth = {
    // Current active session
    getSession: function () {
      const stored = sessionStorage.getItem("rally_auth_session");
      if (!stored) return null;
      try {
        const sess = JSON.parse(stored);
        if (sess && sess.id) {
          const rec = CREDENTIAL_STORE.find(r => r.id === sess.id);
          if (rec && rec.fallback) {
            sess.role = rec.fallback.role;
            sess.badge = rec.fallback.badge;
            sess.committee = rec.fallback.committee;
            sess.allowedCommittees = rec.fallback.allowedCommittees || [rec.fallback.committee];
            sessionStorage.setItem("rally_auth_session", JSON.stringify(sess));
          }
        }
        return sess;
      } catch (e) {
        return null;
      }
    },

    // Authenticate user against hashed database
    authenticate: async function (emailInput, passwordInput) {
      if (!emailInput || !passwordInput) {
        return { success: false, error: "Please enter both email and password." };
      }

      const normEmail = emailInput.trim().toLowerCase();
      const cleanPass = passwordInput.trim();

      // Find matching user by email hash
      let matchedRecord = null;
      for (const rec of CREDENTIAL_STORE) {
        const testHash = await computeSha256(normEmail + rec.salt);
        if (testHash === rec.emailHash) {
          matchedRecord = rec;
          break;
        }
      }

      if (!matchedRecord) {
        return { success: false, error: "Invalid email or credentials." };
      }

      // Check password hash
      const passHashTest = await computeSha256(cleanPass + matchedRecord.salt);
      const isPassValid = matchedRecord.passHashes.includes(passHashTest);

      if (!isPassValid) {
        return { success: false, error: "Incorrect password. Please try again." };
      }

      // Decrypt profile
      const decrypted = await decryptProfile(normEmail + ":" + cleanPass, matchedRecord.encryptedProfile);
      
      const profile = {
        id: matchedRecord.id,
        name: (decrypted && decrypted.name) || matchedRecord.fallback.name,
        committee: (decrypted && decrypted.committee) || matchedRecord.fallback.committee,
        allowedCommittees: (decrypted && decrypted.allowedCommittees) || matchedRecord.fallback.allowedCommittees || [matchedRecord.fallback.committee],
        role: matchedRecord.fallback.role,
        badge: matchedRecord.fallback.badge,
        isAdmin: matchedRecord.fallback.isAdmin,
        email: emailInput.trim(),
        loginTime: new Date().toISOString()
      };

      sessionStorage.setItem("rally_auth_session", JSON.stringify(profile));
      return { success: true, profile };
    },

    logout: function () {
      sessionStorage.removeItem("rally_auth_session");
      window.location.reload();
    }
  };
})();
