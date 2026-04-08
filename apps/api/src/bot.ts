import { createRedisState } from "@chat-adapter/state-redis";
import { Chat } from "chat";
import { createSendblueAdapter } from "chat-adapter-sendblue";

const bot = new Chat({
  userName: "caltext",
  adapters: {
    sendblue: createSendblueAdapter(),
  },
  state: createRedisState(),
}).registerSingleton();

export default bot;
