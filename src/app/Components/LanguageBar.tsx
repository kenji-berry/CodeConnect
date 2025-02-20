interface LanguageBarProps {
    languages: Record<string, number>;
  }
  
  const LanguageBar: React.FC<LanguageBarProps> = ({ languages }) => {
    const total = Object.values(languages).reduce((sum, count) => sum + count, 0);
    
    // Generate a random color for each language
    const getLanguageColor = (language: string) => {
      let hash = 0;
      for (let i = 0; i < language.length; i++) {
        hash = language.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = hash % 360;
      return `hsl(${hue}, 70%, 60%)`;
    };
  
    return (
      <div className="w-full mt-4">
        <div className="w-full h-6 flex rounded-lg overflow-hidden">
          {Object.entries(languages).map(([language, count], index) => {
            const percentage = (count / total) * 100;
            return (
              <div
                key={language}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: getLanguageColor(language),
                }}
                className="h-full hover:brightness-90 transition-all"
                title={`${language}: ${percentage.toFixed(1)}%`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(languages).map(([language, count]) => {
            const percentage = (count / total) * 100;
            return (
              <div key={language} className="flex items-center text-sm">
                <div
                  className="w-3 h-3 rounded-full mr-1"
                  style={{ backgroundColor: getLanguageColor(language) }}
                />
                <span>{language}: {percentage.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  export default LanguageBar;