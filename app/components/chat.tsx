import { useDebounce, useDebouncedCallback } from "use-debounce";
import { memo, useState, useRef, useEffect, useLayoutEffect } from "react";
import { synth, AllVoices } from "./settings";
import SendWhiteIcon from "../icons/send-white.svg";
import ChatIcon from "../icons/chat.svg";
import BrainIcon from "../icons/brain.svg";
import RenameIcon from "../icons/rename.svg";
import ExportIcon from "../icons/share.svg";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import DownloadIcon from "../icons/download.svg";
import LoadingIcon from "../icons/three-dots.svg";
import BotIcon from "../icons/bot.svg";
import BlackBotIcon from "../icons/black-bot.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";

import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import AutoIcon from "../icons/auto.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";

import {
  Message,
  SubmitKey,
  useChatStore,
  BOT_HELLO,
  ROLES,
  createMessage,
  useAccessStore,
  Theme,
  ModelType,
  useAppConfig,
} from "../store";

import {
  copyToClipboard,
  downloadAs,
  getEmojiUrl,
  selectOrCopy,
  autoGrowTextArea,
  useMobileScreen,
  isMobile,
} from "../utils";

import dynamic from "next/dynamic";

import { ControllerPool } from "../requests";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";

import { IconButton } from "./button";
import styles from "./home.module.scss";
import chatStyle from "./chat.module.scss";

import { Input, Modal, showModal, showToast } from "./ui-lib";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";

const Markdown = dynamic(
  async () => memo((await import("./markdown")).Markdown),
  {
    loading: () => <LoadingIcon />,
  },
);

const Emoji = dynamic(async () => (await import("emoji-picker-react")).Emoji, {
  loading: () => <LoadingIcon />,
});

export function Avatar(props: { role: Message["role"]; model?: ModelType }) {
  const config = useAppConfig();

  if (props.role !== "user") {
    return (
      <div className="no-dark">
        {props.model?.startsWith("gpt-4") ? (
          <BlackBotIcon className={styles["user-avtar"]} />
        ) : (
          <BotIcon className={styles["user-avtar"]} />
        )}
      </div>
    );
  }

  return (
    <div className={styles["user-avtar"]}>
      <Emoji unified={config.avatar} size={18} getEmojiUrl={getEmojiUrl} />
    </div>
  );
}

function exportMessages(messages: Message[], topic: string) {
  const mdText =
    `# ${topic}\n\n` +
    messages
      .map((m) => {
        return m.role === "user"
          ? `## ${Locale.Export.MessageFromYou}:\n${m.content}`
          : `## ${Locale.Export.MessageFromChatGPT}:\n${m.content.trim()}`;
      })
      .join("\n\n");
  const filename = `${topic}.md`;

  showModal({
    title: Locale.Export.Title,
    children: (
      <div className="markdown-body">
        <pre className={styles["export-content"]}>{mdText}</pre>
      </div>
    ),
    actions: [
      <IconButton
        key="copy"
        icon={<CopyIcon />}
        bordered
        text={Locale.Export.Copy}
        onClick={() => copyToClipboard(mdText)}
      />,
      <IconButton
        key="download"
        icon={<DownloadIcon />}
        bordered
        text={Locale.Export.Download}
        onClick={() => downloadAs(mdText, filename)}
      />,
    ],
  });
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.context;

  const addContextPrompt = (prompt: Message) => {
    chatStore.updateCurrentSession((session) => {
      session.context.push(prompt);
    });
  };

  const removeContextPrompt = (i: number) => {
    chatStore.updateCurrentSession((session) => {
      session.context.splice(i, 1);
    });
  };

  const updateContextPrompt = (i: number, prompt: Message) => {
    chatStore.updateCurrentSession((session) => {
      session.context[i] = prompt;
    });
  };

  return (
    <div className={chatStyle["prompt-toast"]} key="prompt-toast">
      {props.showToast && (
        <div
          className={chatStyle["prompt-toast-inner"] + " clickable"}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={chatStyle["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <div className="modal-mask">
          <Modal
            title={Locale.Context.Edit}
            onClose={() => props.setShowModal(false)}
            actions={[
              <IconButton
                key="reset"
                icon={<CopyIcon />}
                bordered
                text={Locale.Memory.Reset}
                onClick={() =>
                  confirm(Locale.Memory.ResetConfirm) &&
                  chatStore.resetSession()
                }
              />,
              <IconButton
                key="copy"
                icon={<CopyIcon />}
                bordered
                text={Locale.Memory.Copy}
                onClick={() => copyToClipboard(session.memoryPrompt)}
              />,
            ]}
          >
            <>
              <div className={chatStyle["context-prompt"]}>
                {context.map((c, i) => (
                  <div className={chatStyle["context-prompt-row"]} key={i}>
                    <select
                      value={c.role}
                      className={chatStyle["context-role"]}
                      onChange={(e) =>
                        updateContextPrompt(i, {
                          ...c,
                          role: e.target.value as any,
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={c.content}
                      type="text"
                      className={chatStyle["context-content"]}
                      rows={1}
                      onInput={(e) =>
                        updateContextPrompt(i, {
                          ...c,
                          content: e.currentTarget.value as any,
                        })
                      }
                    />
                    <IconButton
                      icon={<DeleteIcon />}
                      className={chatStyle["context-delete-button"]}
                      onClick={() => removeContextPrompt(i)}
                      bordered
                    />
                  </div>
                ))}

                <div className={chatStyle["context-prompt-row"]}>
                  <IconButton
                    icon={<AddIcon />}
                    text={Locale.Context.Add}
                    bordered
                    className={chatStyle["context-prompt-button"]}
                    onClick={() =>
                      addContextPrompt({
                        role: "system",
                        content: "",
                        date: "",
                      })
                    }
                  />
                </div>
              </div>
              <div className={chatStyle["memory-prompt"]}>
                <div className={chatStyle["memory-prompt-title"]}>
                  <span>
                    {Locale.Memory.Title} ({session.lastSummarizeIndex} of{" "}
                    {session.messages.length})
                  </span>

                  <label className={chatStyle["memory-prompt-action"]}>
                    {Locale.Memory.Send}
                    <input
                      type="checkbox"
                      checked={session.sendMemory}
                      onChange={() =>
                        chatStore.updateCurrentSession(
                          (session) =>
                            (session.sendMemory = !session.sendMemory),
                        )
                      }
                    ></input>
                  </label>
                </div>
                <div className={chatStyle["memory-prompt-content"]}>
                  {session.memoryPrompt || Locale.Memory.EmptyContent}
                </div>
              </div>
            </>
          </Modal>
        </div>
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && e.nativeEvent.isComposing) return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export function PromptHints(props: {
  prompts: Prompt[];
  onPromptSelect: (prompt: Prompt) => void;
}) {
  if (props.prompts.length === 0) return null;

  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          className={styles["prompt-hint"]}
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}

function useScrollToBottom() {
  // for auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollToBottom = () => {
    const dom = scrollRef.current;
    if (dom) {
      setTimeout(() => (dom.scrollTop = dom.scrollHeight), 1);
    }
  };

  // auto scroll
  useLayoutEffect(() => {
    autoScroll && scrollToBottom();
  });

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollToBottom,
  };
}

export function ChatActions(props: {
  showPromptModal: () => void;
  scrollToBottom: () => void;
  hitBottom: boolean;
}) {
  const config = useAppConfig();

  // switch themes
  const theme = config.theme;

  function nextTheme() {
    const themes = [Theme.Auto, Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // stop all responses
  const couldStop = ControllerPool.hasPending();
  const stopAll = () => ControllerPool.stopAll();

  return (
    <div className={chatStyle["chat-input-actions"]}>
      {couldStop && (
        <div
          className={`${chatStyle["chat-input-action"]} clickable`}
          onClick={stopAll}
        >
          <StopIcon />
        </div>
      )}
      {!props.hitBottom && (
        <div
          className={`${chatStyle["chat-input-action"]} clickable`}
          onClick={props.scrollToBottom}
        >
          <BottomIcon />
        </div>
      )}
      {props.hitBottom && (
        <div
          className={`${chatStyle["chat-input-action"]} clickable`}
          onClick={props.showPromptModal}
        >
          <BrainIcon />
        </div>
      )}

      <div
        className={`${chatStyle["chat-input-action"]} clickable`}
        onClick={nextTheme}
      >
        {theme === Theme.Auto ? (
          <AutoIcon />
        ) : theme === Theme.Light ? (
          <LightIcon />
        ) : theme === Theme.Dark ? (
          <DarkIcon />
        ) : null}
      </div>
    </div>
  );
}

export function Chat() {
  let recognition: any;
  // 判断是否是移动端  如果是移动端则不展示语音按钮
  if (isMobile()) {
    const speakBtn = document.getElementsByClassName(
      "home_chat-speak__PcUVx",
    )[0] as HTMLElement;
    if (speakBtn && speakBtn.style) {
      // 在移动端隐藏语音按钮
      speakBtn.style.display = "none";
    }
  } else {
    recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    // 配置设置以使每次识别都返回连续结果
    recognition.continuous = false;
    // 配置应返回临时结果的设置
    recognition.interimResults = false;
    recognition.lang = "zh-CN"; //定义普通话 (中国大陆)
    recognition.addEventListener("start", (event: any) => {
      setSpeakText("讲话中...");
    });
    recognition.addEventListener("result", (event: any) => {
      // 获取当前文本域内容
      let text = userInput;
      // 追加语音内容
      text += event.results[0][0].transcript;
      // 重新设置文本域内容
      setUserInput(text);
      setSpeakText("语音");
    });
    recognition.addEventListener("end", (event: any) => {
      setSpeakText("语音");
    });
    recognition.addEventListener("error", (event: any) => {
      setSpeakText("语音");
    });
  }

  type RenderMessage = Message & { preview?: boolean };

  const chatStore = useChatStore();
  const [session, sessionIndex] = useChatStore((state) => [
    state.currentSession(),
    state.currentSessionIndex,
  ]);
  const config = useAppConfig();
  const fontSize = config.fontSize;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [beforeInput, setBeforeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const { scrollRef, setAutoScroll, scrollToBottom } = useScrollToBottom();
  const [hitBottom, setHitBottom] = useState(false);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();

  const [speakText, setSpeakText] = useState("语音");
  const [speechText, setSpeechText] = useState("播放");
  const speechModelName =
    Locale.Settings.PaddleSpeech.Options[
      localStorage.getItem(
        "paddleSpeech",
      ) as keyof typeof Locale.Settings.PaddleSpeech.Options
    ] ?? Locale.Settings.PaddleSpeech.Options["ysg"];
  const [paddleSpeechText, setPaddleSpeechText] = useState(speechModelName);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    async function fetchVoices() {
      const allVoices = await AllVoices;
      setVoices(allVoices);
    }

    fetchVoices();
  }, []);

  const onChatBodyScroll = (e: HTMLElement) => {
    const isTouchBottom = e.scrollTop + e.clientHeight >= e.scrollHeight - 20;
    setHitBottom(isTouchBottom);
  };

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<Prompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      setPromptHints(promptStore.search(text));
    },
    100,
    { leading: true, trailing: true },
  );

  const onPromptSelect = (prompt: Prompt) => {
    setUserInput(prompt.content);
    setPromptHints([]);
    inputRef.current?.focus();
  };

  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        5,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  // submit user input
  const onUserSubmit = () => {
    if (userInput.length <= 0) return;
    setIsLoading(true);
    chatStore.onUserInput(userInput).then(() => setIsLoading(false));
    setBeforeInput(userInput);
    setUserInput("");
    setPromptHints([]);
    if (!isMobileScreen) inputRef.current?.focus();
    setAutoScroll(true);
  };

  // 语音按钮的点击事件
  const onSpeak = () => {
    recognition.start();
  };

  // stop response
  const onUserStop = (messageId: number) => {
    ControllerPool.stop(sessionIndex, messageId);
  };

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput
    if (e.key === "ArrowUp" && userInput.length <= 0) {
      setUserInput(beforeInput);
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e)) {
      onUserSubmit();
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: Message) => {
    // auto fill user input
    if (message.role === "user") {
      setUserInput(message.content);
    }

    // copy to clipboard
    if (selectOrCopy(e.currentTarget, message.content)) {
      e.preventDefault();
    }
  };

  const findLastUserIndex = (messageId: number) => {
    // find last user input message and resend
    let lastUserMessageIndex: number | null = null;
    for (let i = 0; i < session.messages.length; i += 1) {
      const message = session.messages[i];
      if (message.id === messageId) {
        break;
      }
      if (message.role === "user") {
        lastUserMessageIndex = i;
      }
    }

    return lastUserMessageIndex;
  };

  const deleteMessage = (userIndex: number) => {
    chatStore.updateCurrentSession((session) =>
      session.messages.splice(userIndex, 2),
    );
  };

  const onDelete = (botMessageId: number) => {
    const userIndex = findLastUserIndex(botMessageId);
    if (userIndex === null) return;
    deleteMessage(userIndex);
  };

  const onResend = (botMessageId: number) => {
    // find last user input message and resend
    const userIndex = findLastUserIndex(botMessageId);
    if (userIndex === null) return;

    setIsLoading(true);
    const content = session.messages[userIndex].content;
    deleteMessage(userIndex);
    chatStore.onUserInput(content).then(() => setIsLoading(false));
    inputRef.current?.focus();
  };

  const context: RenderMessage[] = session.context.slice();

  const accessStore = useAccessStore();

  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }

  // preview messages
  const messages = context
    .concat(session.messages as RenderMessage[])
    .concat(
      isLoading
        ? [
            {
              ...createMessage({
                role: "assistant",
                content: "……",
              }),
              preview: true,
            },
          ]
        : [],
    )
    .concat(
      userInput.length > 0 && config.sendPreviewBubble
        ? [
            {
              ...createMessage({
                role: "user",
                content: userInput,
              }),
              preview: true,
            },
          ]
        : [],
    );

  const [showPromptModal, setShowPromptModal] = useState(false);

  const renameSession = () => {
    const newTopic = prompt(Locale.Chat.Rename, session.topic);
    if (newTopic && newTopic !== session.topic) {
      chatStore.updateCurrentSession((session) => (session.topic = newTopic!));
    }
  };

  const botRead = (text: string) => {
    if (synth == null) {
      // synth对象为空
      showToast("当前浏览器不支持语音播放功能");
      return;
    }
    // 如果当前正在播放 则中断当前的播放
    if (synth.speaking) {
      synth.cancel();
    } else {
      // 创建utterance对象 传入的text为要朗读的文本
      let utterance = new SpeechSynthesisUtterance(text);
      // 设置回调函数
      utterance.onstart = () => {
        setSpeechText("结束");
      };
      utterance.onend = () => {
        setSpeechText("播放");
      };
      utterance.onerror = () => {
        setSpeechText("播放");
      };
      const voice = voices.filter(
        (voice) => voice.voiceURI === localStorage.getItem("voice"),
      )[0];
      // 这里的voice一直在 await AllVoices，有值时才设置
      if (voice) {
        // 设置声音
        utterance.voice = voice;
      }
      // 语速
      utterance.rate = config.speechRate;
      // 音调
      utterance.pitch = config.speechPitch;
      // 播放语音
      synth.speak(utterance);
    }
  };

  function getHeaders() {
    const accessStore = useAccessStore.getState();
    let headers: Record<string, string> = {};

    if (accessStore.enabledAccessControl()) {
      headers["access-code"] = accessStore.accessCode;
    }

    if (accessStore.token && accessStore.token.length > 0) {
      headers["token"] = accessStore.token;
    }

    return headers;
  }

  //自定义训练模型语音播报 modelName:声音模型名称  messageId:消息id  messageContent:消息内容
  const textToAudio = async (
    modelName: any,
    messageId: any,
    messageContent: string,
  ) => {
    if (paddleSpeechText === "生成中") {
      showToast("音频正在生成中，请勿重复点击！");
      return;
    }
    if (paddleSpeechText === "播放中") {
      showToast("音频正在播放中，请勿重复点击！");
      return;
    }

    try {
      setPaddleSpeechText("生成中");
      const response = await fetch(
        "https://www.chatgpt-wang.cn/api/chatgpt/paddleSpeech/textToAudio",
        {
          method: "POST",
          mode: "cors",
          body: JSON.stringify({ modelName, messageId, messageContent }),
          headers: {
            "Content-Type": "application/json",
            ...getHeaders(),
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        // 获得cos签名url
        const url = data.data;
        // audio设置url属性
        const audio = new Audio(url);
        // 监听音频全部数据已加载完成
        audio.addEventListener("canplaythrough", () => {
          audio.play();
          setPaddleSpeechText("播放中");
        });
        // 监听音频播放结束
        audio.addEventListener("ended", () => {
          setPaddleSpeechText(speechModelName);
        });
        // 监听音频播放异常
        audio.addEventListener("error", () => {
          setPaddleSpeechText(speechModelName);
          showToast("播放异常，请稍后重试！");
        });
      } else {
        setPaddleSpeechText(speechModelName);
        showToast(data.errorMsg);
      }
    } catch (error) {
      setPaddleSpeechText(speechModelName);
      console.log(error);
      showToast("播放异常，请稍后重试！");
    }
  };

  // Auto focus
  useEffect(() => {
    if (isMobileScreen) return;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.chat} key={session.id}>
      <div className={styles["window-header"]}>
        <div className={styles["window-header-title"]}>
          <div
            className={`${styles["window-header-main-title"]} ${styles["chat-body-title"]}`}
            onClickCapture={renameSession}
          >
            {session.topic}
          </div>
          <div className={styles["window-header-sub-title"]}>
            {Locale.Chat.SubTitle(session.messages.length)}
          </div>
        </div>
        <div className={styles["window-actions"]}>
          <div className={styles["window-action-button"] + " " + styles.mobile}>
            <IconButton
              icon={<ReturnIcon />}
              bordered
              title={Locale.Chat.Actions.ChatList}
              onClick={() => navigate(Path.Home)}
            />
          </div>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<RenameIcon />}
              bordered
              onClick={renameSession}
            />
          </div>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<ExportIcon />}
              bordered
              title={Locale.Chat.Actions.Export}
              onClick={() => {
                exportMessages(
                  session.messages.filter((msg) => !msg.isError),
                  session.topic,
                );
              }}
            />
          </div>
          {!isMobileScreen && (
            <div className={styles["window-action-button"]}>
              <IconButton
                icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
                bordered
                onClick={() => {
                  config.update(
                    (config) => (config.tightBorder = !config.tightBorder),
                  );
                }}
              />
            </div>
          )}
        </div>

        <PromptToast
          showToast={!hitBottom}
          showModal={showPromptModal}
          setShowModal={setShowPromptModal}
        />
      </div>

      <div
        className={styles["chat-body"]}
        ref={scrollRef}
        onScroll={(e) => onChatBodyScroll(e.currentTarget)}
        onMouseDown={() => inputRef.current?.blur()}
        onWheel={(e) => setAutoScroll(hitBottom && e.deltaY > 0)}
        onTouchStart={() => {
          inputRef.current?.blur();
          setAutoScroll(false);
        }}
      >
        {messages.map((message, i) => {
          const isUser = message.role === "user";
          const showActions =
            !isUser &&
            i > 0 &&
            !(message.preview || message.content.length === 0);
          const showTyping = message.preview || message.streaming;

          return (
            <div
              key={i}
              className={
                isUser ? styles["chat-message-user"] : styles["chat-message"]
              }
            >
              <div className={styles["chat-message-container"]}>
                <div className={styles["chat-message-avatar"]}>
                  <Avatar role={message.role} model={message.model} />
                </div>
                {showTyping && (
                  <div className={styles["chat-message-status"]}>
                    {Locale.Chat.Typing}
                  </div>
                )}
                <div className={styles["chat-message-item"]}>
                  {showActions && (
                    <div className={styles["chat-message-top-actions"]}>
                      {message.streaming ? (
                        <div
                          className={styles["chat-message-top-action"]}
                          onClick={() => onUserStop(message.id ?? i)}
                        >
                          {Locale.Chat.Actions.Stop}
                        </div>
                      ) : (
                        <>
                          <div
                            className={styles["chat-message-top-action"]}
                            onClick={() => onDelete(message.id ?? i)}
                          >
                            {Locale.Chat.Actions.Delete}
                          </div>
                          <div
                            className={styles["chat-message-top-action"]}
                            onClick={() => onResend(message.id ?? i)}
                          >
                            {Locale.Chat.Actions.Retry}
                          </div>
                        </>
                      )}

                      <div
                        className={styles["chat-message-top-action"]}
                        onClick={() => copyToClipboard(message.content)}
                      >
                        {Locale.Chat.Actions.Copy}
                      </div>

                      {config.paddleSpeechEnable ? (
                        <div
                          className={styles["chat-message-top-action"]}
                          onClick={() =>
                            textToAudio(
                              localStorage.getItem("paddleSpeech")
                                ? localStorage.getItem("paddleSpeech")
                                : "ysg",
                              message.id,
                              message.content,
                            )
                          }
                        >
                          {paddleSpeechText}
                        </div>
                      ) : (
                        <div
                          className={styles["chat-message-top-action"]}
                          onClick={() => botRead(message.content)}
                        >
                          {speechText}
                        </div>
                      )}
                    </div>
                  )}
                  <Markdown
                    content={message.content}
                    loading={
                      (message.preview || message.content.length === 0) &&
                      !isUser
                    }
                    onContextMenu={(e) => onRightClick(e, message)}
                    onDoubleClickCapture={() => {
                      if (!isMobileScreen) return;
                      setUserInput(message.content);
                    }}
                    fontSize={fontSize}
                    parentRef={scrollRef}
                  />
                </div>
                {!isUser && !message.preview && (
                  <div className={styles["chat-message-actions"]}>
                    <div className={styles["chat-message-action-date"]}>
                      {message.date.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles["chat-input-panel"]}>
        <PromptHints prompts={promptHints} onPromptSelect={onPromptSelect} />

        <ChatActions
          showPromptModal={() => setShowPromptModal(true)}
          scrollToBottom={scrollToBottom}
          hitBottom={hitBottom}
        />
        <div className={styles["chat-input-panel-inner"]}>
          <textarea
            ref={inputRef}
            className={styles["chat-input"]}
            placeholder={Locale.Chat.Input(submitKey)}
            onInput={(e) => onInput(e.currentTarget.value)}
            value={userInput}
            onKeyDown={onInputKeyDown}
            onFocus={() => setAutoScroll(true)}
            onBlur={() => {
              setAutoScroll(false);
              setTimeout(() => setPromptHints([]), 500);
            }}
            autoFocus
            rows={inputRows}
          />
          <IconButton
            icon={<SendWhiteIcon />}
            text={Locale.Chat.Send}
            className={styles["chat-input-send"]}
            noDark
            onClick={onUserSubmit}
          />
          <IconButton
            icon={<ChatIcon />}
            text={speakText}
            className={styles["chat-speak"]}
            noDark
            onClick={onSpeak}
          />
        </div>
      </div>
    </div>
  );
}
