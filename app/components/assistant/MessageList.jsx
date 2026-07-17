/**

 * Message list for the assistant chat transcript.

 */



import { useEffect, useLayoutEffect, useRef } from "react";
import SmartActionGrid from "./SmartActionGrid.jsx";
import PhotoPrompt from "./PhotoPrompt.jsx";
import TeachControls from "./TeachControls.jsx";



function ProductCards({ cards, onSelect, disabled = false }) {

  if (!cards?.length) return null;

  return (

    <div className="ea-cards">

      {cards.map((card, index) => {

        const rank = card.rank || index + 1;

        return (

        <article key={card.id} className={`ea-card${rank === 1 ? " ea-card--best" : ""}`}>

          {card.image ? (

            <img className="ea-card-img" src={card.image} alt={card.title} />

          ) : (

            <div className="ea-card-img ea-card-img--empty" aria-hidden="true" />

          )}

          <div className="ea-card-body">

            <div className="ea-card-heading">

              <span className="ea-card-rank" aria-label={`Rank ${rank}`}>

                #{rank}

              </span>

              <h3 className="ea-card-title">{card.title}</h3>

            </div>

            <p className="ea-card-meta">

              {card.price ? `${card.price} ${card.currency || ""}` : ""}

              {card.collection ? ` · ${card.collection}` : ""}

            </p>

            {card.matchReason ? (

              <p className="ea-card-why">{card.matchReason}</p>

            ) : null}

            <div className="ea-card-actions">

              {onSelect ? (

                <button

                  type="button"

                  className="ea-card-select"

                  disabled={disabled}

                  onClick={() => onSelect(card)}

                >

                  Select

                </button>

              ) : null}

              {card.url ? (

                <a className="ea-card-link" href={card.url} target="_blank" rel="noreferrer">

                  View

                </a>

              ) : null}

            </div>

          </div>

        </article>

        );

      })}

    </div>

  );

}



const NEAR_BOTTOM_PX = 120;



export default function MessageList({

  messages = [],

  onAction,

  onSelectProduct,

  onPhotoSelect,

  actionsDisabled = false,

  locale = "ar",

  stickyScrollToken = 0,

  forceStickToken = 0,

  trainMode = false,

  onTeachApprove,

  onTeachCorrect,

  onTeachNew,

}) {

  const scrollerRef = useRef(null);

  const bottomRef = useRef(null);

  const stickToBottomRef = useRef(true);

  const lastIndex = messages.length - 1;



  useEffect(() => {

    const node = scrollerRef.current;

    if (!node) return undefined;



    const onScroll = () => {

      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;

      stickToBottomRef.current = distance <= NEAR_BOTTOM_PX;

    };



    node.addEventListener("scroll", onScroll, { passive: true });

    return () => node.removeEventListener("scroll", onScroll);

  }, []);



  useEffect(() => {

    if (forceStickToken > 0) {

      stickToBottomRef.current = true;

    }

  }, [forceStickToken]);



  const scrollToLatest = (behavior = "smooth", force = false) => {
    if (!force && !stickToBottomRef.current) return;

    const node = scrollerRef.current;
    const anchor = bottomRef.current;
    if (node) {
      // Direct scrollTop is more reliable than scrollIntoView inside nested flex overflow.
      const top = node.scrollHeight;
      if (behavior === "auto") {
        node.scrollTop = top;
      } else {
        node.scrollTo({ top, behavior });
      }
    } else if (anchor) {
      anchor.scrollIntoView({ behavior, block: "end" });
    }
  };

  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    const forceAssistant =
      last?.role === "assistant" || forceStickToken > 0;
    if (forceAssistant) {
      stickToBottomRef.current = true;
    }
    scrollToLatest("auto", forceAssistant);
    requestAnimationFrame(() => {
      scrollToLatest("auto", forceAssistant);
    });
  }, [messages, stickyScrollToken, forceStickToken]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return undefined;

    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        scrollToLatest("auto", true);
      }
    });
    observer.observe(node);
    for (const child of node.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [messages.length]);



  return (

    <div className="ea-messages" aria-live="polite" ref={scrollerRef}>

      {messages.map((msg, index) => {

        const isUser = msg.role === "user";

        const photoKind =

          msg.meta?.photoKind === "product" ? "product" : "room";

        const showPhotoPrompt =

          msg.type === "photo_prompt" && index === lastIndex;

        return (

          <div

            key={msg.id}

            className={`ea-bubble-row ${isUser ? "ea-bubble-row--user" : ""}`}

          >

            <div

              className={`ea-bubble ${isUser ? "ea-bubble--user" : "ea-bubble--assistant"}`}

            >

              {msg.content ? (

                <p className="ea-bubble-text">{msg.content}</p>

              ) : null}

              {msg.actions?.length && index === lastIndex ? (

                <SmartActionGrid

                  actions={msg.actions}

                  onSelect={onAction}

                  disabled={actionsDisabled}

                  locale={locale}

                />

              ) : null}

              {showPhotoPrompt ? (

                <PhotoPrompt

                  photoKind={photoKind}

                  locale={locale}

                  disabled={actionsDisabled}

                  onSelect={onPhotoSelect}

                />

              ) : null}

              {msg.type === "product_cards" ? (

                <ProductCards

                  cards={msg.cards}

                  disabled={actionsDisabled}

                  onSelect={onSelectProduct}

                />

              ) : null}

              {trainMode &&
              !isUser &&
              (msg.meta?.teachable || msg.meta?.needsTeach) ? (
                <TeachControls
                  message={msg}
                  locale={locale}
                  disabled={actionsDisabled}
                  onApprove={onTeachApprove}
                  onCorrect={onTeachCorrect}
                  onTeach={onTeachNew}
                />
              ) : null}

            </div>

          </div>

        );

      })}

      <div ref={bottomRef} className="ea-messages-anchor" aria-hidden="true" />

      <style>{`

        .ea-messages {

          display: flex;

          flex-direction: column;

          gap: 0.9rem;

          padding: 1.25rem 1.1rem 1rem;

          overflow-y: auto;

          overflow-x: hidden;

          flex: 1;

          min-height: 0;

          scroll-behavior: smooth;

        }

        .ea-messages-anchor {

          flex-shrink: 0;

          width: 100%;

          height: 1px;

        }

        .ea-bubble-row {

          display: flex;

          justify-content: flex-start;

        }

        .ea-bubble-row--user {

          justify-content: flex-end;

        }

        .ea-bubble {

          max-width: min(100%, 34rem);

          border-radius: 1.1rem;

          padding: 0.95rem 1rem;

        }

        .ea-bubble--assistant {

          background: rgba(255, 255, 255, 0.78);

          border: 1px solid rgba(28, 45, 58, 0.08);

          box-shadow: 0 10px 30px rgba(28, 45, 58, 0.05);

        }

        .ea-bubble--user {

          background: #1c2d3a;

          color: #f7f1e8;

        }

        .ea-bubble-text {

          margin: 0;

          line-height: 1.55;

          font-size: 0.98rem;

          white-space: pre-wrap;

        }

        .ea-cards {

          display: grid;

          gap: 0.75rem;

          margin-top: 0.85rem;

        }

        .ea-card {

          display: grid;

          grid-template-columns: 4.5rem 1fr;

          gap: 0.75rem;

          align-items: center;

          border: 1px solid rgba(28, 45, 58, 0.1);

          border-radius: 0.9rem;

          overflow: hidden;

          background: #fff;

          transition: border-color 160ms ease, box-shadow 160ms ease;

        }

        .ea-card--best {

          border-color: rgba(154, 115, 64, 0.45);

          box-shadow: 0 8px 22px rgba(154, 115, 64, 0.12);

        }

        .ea-card-img {

          width: 4.5rem;

          height: 4.5rem;

          object-fit: cover;

          display: block;

        }

        .ea-card-img--empty {

          background: linear-gradient(145deg, #d7e0e8, #f3eee6);

        }

        .ea-card-body {

          padding: 0.55rem 0.7rem 0.55rem 0;

        }

        .ea-card-heading {

          display: flex;

          align-items: baseline;

          gap: 0.4rem;

        }

        .ea-card-rank {

          flex: 0 0 auto;

          font-size: 0.72rem;

          font-weight: 800;

          letter-spacing: 0.02em;

          color: #9a7340;

        }

        .ea-card-title {

          margin: 0;

          font-size: 0.92rem;

          font-weight: 700;

          color: #1c2d3a;

        }

        .ea-card-meta {

          margin: 0.25rem 0 0.2rem;

          font-size: 0.8rem;

          color: rgba(28, 45, 58, 0.7);

        }

        .ea-card-why {

          margin: 0 0 0.4rem;

          font-size: 0.76rem;

          line-height: 1.35;

          color: rgba(28, 45, 58, 0.62);

        }

        .ea-card-actions {

          display: flex;

          flex-wrap: wrap;

          gap: 0.55rem;

          align-items: center;

        }

        .ea-card-select {

          appearance: none;

          border: 0;

          border-radius: 999px;

          padding: 0.35rem 0.75rem;

          background: #1c2d3a;

          color: #f7f1e8;

          font: inherit;

          font-size: 0.78rem;

          font-weight: 700;

          cursor: pointer;

        }

        .ea-card-select:disabled {

          opacity: 0.45;

          cursor: not-allowed;

        }

        .ea-card-link {

          font-size: 0.8rem;

          color: #9a7340;

          font-weight: 700;

          text-decoration: none;

        }

      `}</style>

    </div>

  );

}

