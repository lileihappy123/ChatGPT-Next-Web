"use client";

require("../polyfill");

import { useState, useEffect, useRef } from "react";

import { IconButton } from "./button";
import styles from "./home.module.scss";

import SettingsIcon from "../icons/settings.svg";
import GithubIcon from "../icons/github.svg";
import ChatGptIcon from "../icons/chatgpt.svg";

import BotIcon from "../icons/bot.svg";
import AddIcon from "../icons/add.svg";
import LoadingIcon from "../icons/three-dots.svg";
import CloseIcon from "../icons/close.svg";

import { useChatStore } from "../store";
import { getCSSVar, isMobileScreen } from "../utils";
import Locale from "../locales";
import { Chat } from "./chat";

import dynamic from "next/dynamic";
import { REPO_URL } from "../constant";
import { ErrorBoundary } from "./error";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={styles["loading-content"]}>
      {!props.noLogo && <BotIcon />}
      <LoadingIcon />
    </div>
  );
}

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => <Loading noLogo />,
});


const Emoji = dynamic(async () => (await import("emoji-picker-react")).Emoji, {
  loading: () => <LoadingIcon />,
});

export function Avatar(props: { role: Message["role"] }) {
  const config = useChatStore((state) => state.config);

  if (props.role === "assistant") {
    return <BotIcon className={styles["user-avtar"]} />;
  }

  return (
    <div className={styles["user-avtar"]}>
      <Emoji unified={config.avatar} size={18} />
    </div>
  );
}

export function ChatItem(props: {
  onClick?: () => void;
  onDelete?: () => void;
  title: string;
  count: number;
  time: string;
  selected: boolean;
}) {
  return (
    <div
      className={`${styles["chat-item"]} ${
        props.selected && styles["chat-item-selected"]
      }`}
      onClick={props.onClick}
    >
      <div className={styles["chat-item-title"]}>{props.title}</div>
      <div className={styles["chat-item-info"]}>
        <div className={styles["chat-item-count"]}>
          {Locale.ChatItem.ChatItemCount(props.count)}
        </div>
        <div className={styles["chat-item-date"]}>{props.time}</div>
      </div>
      <div className={styles["chat-item-delete"]} onClick={props.onDelete}>
        <DeleteIcon />
      </div>
    </div>
  );
}

export function ChatList() {
  const [sessions, selectedIndex, selectSession, removeSession] = useChatStore(
    (state) => [
      state.sessions,
      state.currentSessionIndex,
      state.selectSession,
      state.removeSession,
    ]
  );

  return (
    <div className={styles["chat-list"]}>
      {sessions.map((item, i) => (
        <ChatItem
          title={item.topic}
          time={item.lastUpdate}
          count={item.messages.length}
          key={i}
          selected={i === selectedIndex}
          onClick={() => selectSession(i)}
          onDelete={() => confirm(Locale.Home.DeleteChat) && removeSession(i)}
        />
      ))}
    </div>
  );
}

function useSubmitHandler() {
  const config = useChatStore((state) => state.config);
  const submitKey = config.submitKey;

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return false;
    if(e.key==='Enter' && e.nativeEvent.isComposing) return false
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

export function Chat(props: {
  showSideBar?: () => void;
  sideBarShowing?: boolean;
  autoSize: {
    minRows: number;
    maxRows: number;
  };
}) {
  type RenderMessage = Message & { preview?: boolean };

  const chatStore = useChatStore();
  const [session, sessionIndex] = useChatStore((state) => [
    state.currentSession(),
    state.currentSessionIndex,
  ]);
  const fontSize = useChatStore((state) => state.config.fontSize);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [textareaStyle, setTextareaStyle] = useState({});
  const { submitKey, shouldSubmit } = useSubmitHandler();

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<Prompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      setPromptHints(promptStore.search(text));
    },
    100,
    { leading: true, trailing: true }
  );

  const onPromptSelect = (prompt: Prompt) => {
    setUserInput(prompt.content);
    setPromptHints([]);
    inputRef.current?.focus();
  };

  const scrollInput = () => {
    const dom = inputRef.current;
    if (!dom) return;
    const paddingBottomNum: number = parseInt(
      window.getComputedStyle(dom).paddingBottom,
      10
    );
    dom.scrollTop = dom.scrollHeight - dom.offsetHeight + paddingBottomNum;
  };

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    scrollInput();
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (!chatStore.config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/") && text.length > 1) {
        onSearch(text.slice(1));
      }
    }

    resizeTextarea();
  };

  // set style for textarea
  const resizeTextarea = () => {
    const { minRows, maxRows } = props.autoSize;
    setTextareaStyle(calcTextareaHeight(inputRef.current, minRows, maxRows));
  };

  // submit user input
  const onUserSubmit = () => {
    if (userInput.length <= 0) return;
    setIsLoading(true);
    chatStore.onUserInput(userInput).then(() => setIsLoading(false));
    setUserInput("");
    setPromptHints([]);
    inputRef.current?.focus();
  };

  // stop response
  const onUserStop = (messageIndex: number) => {
    console.log(ControllerPool, sessionIndex, messageIndex);
    ControllerPool.stop(sessionIndex, messageIndex);
  };

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const onResend = (botIndex: number) => {
    // find last user input message and resend
    for (let i = botIndex; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        setIsLoading(true);
        chatStore
          .onUserInput(messages[i].content)
          .then(() => setIsLoading(false));
        inputRef.current?.focus();
        return;
      }
    }
  };

  // for auto-scroll
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const config = useChatStore((state) => state.config);

  // preview messages
  const messages = (session.messages as RenderMessage[])
    .concat(
      isLoading
        ? [
            {
              role: "assistant",
              content: "……",
              date: new Date().toLocaleString(),
              preview: true,
            },
          ]
        : []
    )
    .concat(
      userInput.length > 0 && config.sendPreviewBubble
        ? [
            {
              role: "user",
              content: userInput,
              date: new Date().toLocaleString(),
              preview: false,
            },
          ]
        : []
    );

  // auto scroll
  useLayoutEffect(() => {
    setTimeout(() => {
      const dom = latestMessageRef.current;
      const inputDom = inputRef.current;

      // only scroll when input overlaped message body
      let shouldScroll = true;
      if (dom && inputDom) {
        const domRect = dom.getBoundingClientRect();
        const inputRect = inputDom.getBoundingClientRect();
        shouldScroll = domRect.top > inputRect.top;
      }

      if (dom && autoScroll && shouldScroll) {
        dom.scrollIntoView({
          block: "end",
        });
      }
    }, 500);
  });

  return (
    <div className={styles.chat} key={session.id}>
      <div className={styles["window-header"]}>
        <div
          className={styles["window-header-title"]}
          onClick={props?.showSideBar}
        >
          <div
            className={`${styles["window-header-main-title"]} ${styles["chat-body-title"]}`}
            onClick={() => {
              const newTopic = prompt(Locale.Chat.Rename, session.topic);
              if (newTopic && newTopic !== session.topic) {
                chatStore.updateCurrentSession(
                  (session) => (session.topic = newTopic!)
                );
              }
            }}
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
              icon={<MenuIcon />}
              bordered
              title={Locale.Chat.Actions.ChatList}
              onClick={props?.showSideBar}
            />
          </div>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<BrainIcon />}
              bordered
              title={Locale.Chat.Actions.CompressedHistory}
              onClick={() => {
                showMemoryPrompt(session);
              }}
            />
          </div>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<ExportIcon />}
              bordered
              title={Locale.Chat.Actions.Export}
              onClick={() => {
                exportMessages(session.messages, session.topic);
              }}
            />
          </div>
        </div>
      </div>

      <div className={styles["chat-body"]}>
        {messages.map((message, i) => {
          const isUser = message.role === "user";

          return (
            <div
              key={i}
              className={
                isUser ? styles["chat-message-user"] : styles["chat-message"]
              }
            >
              <div className={styles["chat-message-container"]}>
                <div className={styles["chat-message-avatar"]}>
                  <Avatar role={message.role} />
                </div>
                {(message.preview || message.streaming) && (
                  <div className={styles["chat-message-status"]}>
                    {Locale.Chat.Typing}
                  </div>
                )}
                <div className={styles["chat-message-item"]}>
                  {!isUser &&
                    !(message.preview || message.content.length === 0) && (
                      <div className={styles["chat-message-top-actions"]}>
                        {message.streaming ? (
                          <div
                            className={styles["chat-message-top-action"]}
                            onClick={() => onUserStop(i)}
                          >
                            {Locale.Chat.Actions.Stop}
                          </div>
                        ) : (
                          <div
                            className={styles["chat-message-top-action"]}
                            onClick={() => onResend(i)}
                          >
                            {Locale.Chat.Actions.Retry}
                          </div>
                        )}

                        <div
                          className={styles["chat-message-top-action"]}
                          onClick={() => copyToClipboard(message.content)}
                        >
                          {Locale.Chat.Actions.Copy}
                        </div>
                      </div>
                    )}
                  {(message.preview || message.content.length === 0) &&
                  !isUser ? (
                    <LoadingIcon />
                  ) : (
                    <div
                      className="markdown-body"
                      style={{ fontSize: `${fontSize}px` }}
                      onContextMenu={(e) => onRightClick(e, message)}
                      onDoubleClickCapture={() => {
                        if (!isMobileScreen()) return;
                        setUserInput(message.content);
                      }}
                    >
                      <Markdown content={message.content} />
                    </div>
                  )}
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
        <div ref={latestMessageRef} style={{ opacity: 0, height: "1px" }}>
          -
        </div>
      </div>

      <div className={styles["chat-input-panel"]}>
        <PromptHints prompts={promptHints} onPromptSelect={onPromptSelect} />
        <div className={styles["chat-input-panel-inner"]}>
          <textarea
            ref={inputRef}
            style={textareaStyle}
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
            autoFocus={!props?.sideBarShowing}
          />
          <IconButton
            icon={<SendWhiteIcon />}
            text={Locale.Chat.Send}
            className={styles["chat-input-send"] + " no-dark"}
            onClick={onUserSubmit}
          />
        </div>
      </div>
    </div>
  );
}

function useSwitchTheme() {
  const config = useChatStore((state) => state.config);

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"]:not([media])',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--themeColor");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useDragSideBar() {
  const limit = (x: number) => Math.min(500, Math.max(220, x));

  const chatStore = useChatStore();
  const startX = useRef(0);
  const startDragWidth = useRef(chatStore.config.sidebarWidth ?? 300);
  const lastUpdateTime = useRef(Date.now());

  const handleMouseMove = useRef((e: MouseEvent) => {
    if (Date.now() < lastUpdateTime.current + 100) {
      return;
    }
    lastUpdateTime.current = Date.now();
    const d = e.clientX - startX.current;
    const nextWidth = limit(startDragWidth.current + d);
    chatStore.updateConfig((config) => (config.sidebarWidth = nextWidth));
  });

  const handleMouseUp = useRef(() => {
    startDragWidth.current = chatStore.config.sidebarWidth ?? 300;
    window.removeEventListener("mousemove", handleMouseMove.current);
    window.removeEventListener("mouseup", handleMouseUp.current);
  });

  const onDragMouseDown = (e: MouseEvent) => {
    startX.current = e.clientX;

    window.addEventListener("mousemove", handleMouseMove.current);
    window.addEventListener("mouseup", handleMouseUp.current);
  };

  useEffect(() => {
    if (isMobileScreen()) {
      return;
    }

    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${limit(chatStore.config.sidebarWidth ?? 300)}px`,
    );
  }, [chatStore.config.sidebarWidth]);

  return {
    onDragMouseDown,
  };
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

function _Home() {
  const [createNewSession, currentIndex, removeSession] = useChatStore(
    (state) => [
      state.newSession,
      state.currentSessionIndex,
      state.removeSession,
    ]
  );
  const chatStore = useChatStore();
  const loading = !useHasHydrated();
  const [showSideBar, setShowSideBar] = useState(true);

  // setting
  const [openSettings, setOpenSettings] = useState(false);
  const config = useChatStore((state) => state.config);

  // drag side bar
  const { onDragMouseDown } = useDragSideBar();

  useSwitchTheme();

  if (loading) {
    return <Loading />;
  }

  return (
    <div
      className={`${
        config.tightBorder && !isMobileScreen()
          ? styles["tight-container"]
          : styles.container
      }`}
    >
      <div
        className={styles.sidebar + ` ${showSideBar && styles["sidebar-show"]}`}
      >
        <div className={styles["sidebar-header"]}>
          <div className={styles["sidebar-title"]}>ChatGPT Next</div>
          <div className={styles["sidebar-sub-title"]}>
            Build your own AI assistant.
          </div>
          <div className={styles["sidebar-logo"]}>
            <ChatGptIcon />
          </div>
        </div>

        <div
          className={styles["sidebar-body"]}
          onClick={() => {
            setOpenSettings(false);
            setShowSideBar(false);
          }}
        >
          <ChatList />
        </div>

        <div className={styles["sidebar-tail"]}>
          <div className={styles["sidebar-actions"]}>
            <div className={styles["sidebar-action"] + " " + styles.mobile}>
              <IconButton
                icon={<CloseIcon />}
                onClick={chatStore.deleteSession}
              />
            </div>
            <div className={styles["sidebar-action"]}>
              <IconButton
                icon={<SettingsIcon />}
                onClick={() => {
                  setOpenSettings(true);
                  setShowSideBar(false);
                }}
                shadow
              />
            </div>
            <div className={styles["sidebar-action"]}>
              <a href={REPO_URL} target="_blank">
                <IconButton icon={<GithubIcon />} shadow />
              </a>
            </div>
          </div>
          <div>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Home.NewChat}
              onClick={() => {
                createNewSession();
                setShowSideBar(false);
              }}
              shadow
            />
          </div>
        </div>

        <div
          className={styles["sidebar-drag"]}
          onMouseDown={(e) => onDragMouseDown(e as any)}
        ></div>
      </div>

      <div className={styles["window-content"]}>
        {openSettings ? (
          <Settings
            closeSettings={() => {
              setOpenSettings(false);
              setShowSideBar(true);
            }}
          />
        ) : (
          <Chat
            key="chat"
            showSideBar={() => setShowSideBar(true)}
            sideBarShowing={showSideBar}
          />
        )}
      </div>
    </div>
  );
}

export function Home() {
  return (
    <ErrorBoundary>
      <_Home></_Home>
    </ErrorBoundary>
  );
}
