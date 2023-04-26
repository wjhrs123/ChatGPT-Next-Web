import { useEffect, useState } from "react";
import Locale from "../locales";
import { isMobile } from "../utils";
import { showToast } from "./ui-lib";
import { useAccessStore, useAppConfig } from "../store";

// 获取 SpeechSynthesis 语音合成器
export const synth = getSynth(
  typeof window !== "undefined" ? window : undefined,
);
// 加载可用声音列表
export const AllVoices = getAllVoices().then(
  (voices: SpeechSynthesisVoice[]) => {
    return voices;
  },
);

export function getSynth(
  windowObj: Window | undefined,
): SpeechSynthesis | null {
  if (typeof windowObj !== "undefined") {
    return windowObj.speechSynthesis;
  }
  return null;
}

function getAllVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (synth == null) {
      resolve([]);
    } else {
      // 监听声音列表变化事件
      synth.addEventListener("voiceschanged", () => {
        //const allVoices = synth.getVoices();
        //这里过滤了只展示国内的声音  如果想要获取所有声音则返回上行代码的allVoices
        const chineseVoices = synth
          .getVoices()
          .filter((voice) => voice.lang.includes("zh-"));
        resolve(chineseVoices || []);
      });
    }
  });
}

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

export function Speech(userInput: any, setUserInput: any) {
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

  const config = useAppConfig();

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

  // 语音播报
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

  // 语音按钮的点击事件
  const onSpeak = () => {
    recognition.start();
  };

  return {
    recognition,
    textToAudio,
    botRead,
    onSpeak,
    speakText,
    setSpeakText,
    speechText,
    setSpeechText,
    paddleSpeechText,
    setPaddleSpeechText,
    voices,
    setVoices,
  };
}
