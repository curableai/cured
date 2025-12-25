import React, { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface TypewriterMessageProps extends TextProps {
    text: string;
    shouldAnimate?: boolean;
    onComplete?: () => void;
    typingSpeed?: number;
}

export const TypewriterMessage: React.FC<TypewriterMessageProps> = ({
    text,
    shouldAnimate = false,
    onComplete,
    typingSpeed = 20, // ms per character
    style,
    ...props
}) => {
    const [displayedText, setDisplayedText] = useState(shouldAnimate ? '' : text);
    const animationRef = useRef<any>(null);
    const currentIndexRef = useRef(0);

    useEffect(() => {
        // If text changes and we should animate, reset and start animation
        if (shouldAnimate) {
            // If we already displayed the full text, don't re-animate unless specific conditions (rare)
            // For this chat use case, safe to just start over if prop changes or mount
            if (displayedText === text) return;

            setDisplayedText('');
            currentIndexRef.current = 0;

            const animate = () => {
                if (currentIndexRef.current < text.length) {
                    setDisplayedText((prev) => prev + text.charAt(currentIndexRef.current));
                    currentIndexRef.current += 1;
                    animationRef.current = setTimeout(animate, typingSpeed);
                } else {
                    onComplete?.();
                }
            };

            animate();
        } else {
            // If no animation needed, set full text immediately
            setDisplayedText(text);
        }

        return () => {
            if (animationRef.current) {
                clearTimeout(animationRef.current);
            }
        };
    }, [text, shouldAnimate, typingSpeed]);

    return (
        <Text style={style} {...props}>
            {displayedText}
        </Text>
    );
};
