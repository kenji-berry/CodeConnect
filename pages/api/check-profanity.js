import filter from 'leo-profanity';

export const config = {
    api: {
        bodyParser: true,
    },
};

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }


    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid input' });
        }

        // Check if the text contains profanity
        console.log('Checking profanity for text:', text);
        const containsProfanity = filter.check(text);

        // Clean the text by replacing profane words
        console.log('Cleaning text:', text);
        const cleanedText = filter.clean(text);

        console.log('Profanity check result:', { containsProfanity, cleanedText });
        return res.status(200).json({ isProfane: containsProfanity, cleanedText });
    } catch (error) {
        console.error('Error processing profanity check:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}