import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';

interface TypewriterMessageProps extends TextProps {
    text: string;
    shouldAnimate?: boolean;
    onComplete?: () => void;
    typingSpeed?: number;
}

interface TextChunk {
    content: string;
    isBold: boolean;
}

export const TypewriterMessage: React.FC<TypewriterMessageProps> = ({
    text,
    shouldAnimate = false,
    onComplete,
    typingSpeed = 15,
    style,
    ...props
}) => {
    // 1. Parse text into chunks (Regular vs Bold)
    const chunks = useMemo(() => {
        const result: TextChunk[] = [];
        const parts = text.split(/(\*\*.*?\*\*)/g); // Split by **bold**

        parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                result.push({
                    content: part.slice(2, -2), // Remove **
                    isBold: true
                });
            } else if (part.length > 0) {
                result.push({
                    content: part,
                    isBold: false
                });
            }
        });
        return result;
    }, [text]);

    // 2. Calculate total printable characters
    const totalLength = useMemo(() => chunks.reduce((acc, c) => acc + c.content.length, 0), [chunks]);

    const [visibleCount, setVisibleCount] = useState(shouldAnimate ? 0 : totalLength);
    const animationRef = useRef<any>(null);

    useEffect(() => {
        if (shouldAnimate) {
            // Reset if text changes significantly, or just strict reset
            setVisibleCount(0);

            const animate = () => {
                setVisibleCount(prev => {
                    if (prev < totalLength) {
                        animationRef.current = setTimeout(animate, typingSpeed);
                        return prev + 1;
                    } else {
                        onComplete?.();
                        return prev;
                    }
                });
            };

            animate();
        } else {
            setVisibleCount(totalLength);
        }

        return () => {
            if (animationRef.current) clearTimeout(animationRef.current);
        };
    }, [text, shouldAnimate, totalLength, typingSpeed]);

    // 3. Render visible chunks
    const renderContent = () => {
        let currentCount = 0;

        return chunks.map((chunk, index) => {
            // How much of this chunk can we show?
            const remainingBudget = visibleCount - currentCount;

            if (remainingBudget <= 0) return null; // Not reached yet

            const contentToShow = chunk.content.slice(0, remainingBudget);
            currentCount += chunk.content.length;

            return (
                <Text
                    key={index}
                    style={chunk.isBold ? styles.bold : undefined}
                    selectable={true}
                >
                    {contentToShow}
                </Text>
            );
        });
    };

    return (
        <Text style={style} selectable={true} {...props}>
            {renderContent()}
        </Text>
    );
};

const styles = StyleSheet.create({
    bold: {
        fontWeight: 'bold',
    } as TextStyle
});
