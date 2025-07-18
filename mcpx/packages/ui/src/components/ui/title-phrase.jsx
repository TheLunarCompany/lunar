import { useEffect, useState } from "react";

const PHRASES = [
  "Mostly Confused Penguins",
  "Miniature Coffee Photographers",
  "Mischievous Cloud Puppies",
  "Maltese Cauliflower Protection",
  "Melodramatic Cat People",
  "Mystical Cheese Producers",
  "Mobile Crochet Project",
  "Multicolor Chocolate Pizza",
  "Marvelous Canine Performers",
  "Muddy Construction Pirates",
  "Moderately Chemical Parrot",
  "Magnificent Carrot Professionals",
  "May Contain Peanuts",
  "Mysterious Cactus Plants",
  "Magic Carpet Pilots",
  "More Cowbell, Please",
];

const randomPhrase = () => PHRASES[Math.floor(Math.random() * PHRASES.length)];

export const TitlePhrase = ({ children }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [text, setText] = useState(randomPhrase());

  // Change phrase after not being hovered for 5 seconds
  useEffect(() => {
    const next = () => {
      setText(randomPhrase());
    };
    const timeout = setTimeout(() => {
      if (!isHovered) {
        next();
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isHovered]);

  return (
    <div
      className="contents"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={isHovered ? text : ""}
    >
      {children}
    </div>
  );
};

export default TitlePhrase;
