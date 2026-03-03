// nba_analysis.js
const https = require('https');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');

// API URL za sezonu 2023, max 100 utakmica po request-u
const API_HOST = 'www.balldontlie.io';
const API_PATH = '/api/v1/games?per_page=100&seasons[]=2023';

// ------------------- Fetch NBA Data using https with User-Agent -------------------
function fetchGames() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            path: API_PATH,
            method: 'GET',
            headers: {
                'User-Agent': 'Node.js' // OVO JE KLJUČNO da API vrati JSON, ne HTML
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.data);
                } catch (err) {
                    console.error("Primljeni podatak (prvih 200 karaktera):", data.slice(0,200));
                    reject(err);
                }
            });
        }).on('error', err => reject(err));
    });
}

// ------------------- Game Object -------------------
class Game {
    constructor(game) {
        this.date = new Date(game.date);
        this.homeTeam = game.home_team.full_name;
        this.homeScore = game.home_team_score;
        this.visitorTeam = game.visitor_team.full_name;
        this.visitorScore = game.visitor_team_score;
        this.totalPoints = this.homeScore + this.visitorScore;
    }
}

// ------------------- Analyzer -------------------
class Analyzer {
    constructor(games) {
        this.games = games.map(g => new Game(g));
    }

    averageTotalPoints() {
        const total = this.games.reduce((sum, g) => sum + g.totalPoints, 0);
        return total / this.games.length;
    }

    dayWithMostGames() {
        const dayCount = {};
        this.games.forEach(g => {
            const day = g.date.toISOString().split('T')[0];
            dayCount[day] = (dayCount[day] || 0) + 1;
        });
        return Object.entries(dayCount).sort((a,b)=>b[1]-a[1])[0];
    }

    highestScoringGame() {
        return this.games.reduce((max, g) => 
            g.totalPoints > max.totalPoints ? g : max
        );
    }

    lowestScoringGame() {
        return this.games.reduce((min, g) => 
            g.totalPoints < min.totalPoints ? g : min
        );
    }

    averageHomeScore() {
        const total = this.games.reduce((sum, g) => sum + g.homeScore, 0);
        return total / this.games.length;
    }
}

// ------------------- Plotting -------------------
async function plotTotalPoints(games) {
    const width = 800;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const labels = games.map((_, i) => `Game ${i+1}`);
    const data = games.map(g => g.totalPoints);

    const configuration = {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Total Points per Game',
                data,
                borderColor: 'blue',
                fill: false
            }]
        }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync('total_points_chart.png', buffer);
    console.log("Grafik sacuvan kao total_points_chart.png");
}

// ------------------- Main -------------------
(async () => {
    try {
        const gamesData = await fetchGames();
        const analyzer = new Analyzer(gamesData);

        console.log("Prosek ukupnih poena po utakmici:", analyzer.averageTotalPoints().toFixed(2));
        console.log("Dan sa najvise utakmica:", analyzer.dayWithMostGames()[0]);

        const highest = analyzer.highestScoringGame();
        console.log("Najefikasnija utakmica:",
            `${highest.homeTeam} ${highest.homeScore} - ${highest.visitorTeam} ${highest.visitorScore} (Ukupno: ${highest.totalPoints})`
        );

        const lowest = analyzer.lowestScoringGame();
        console.log("Najmanje poena na utakmici:",
            `${lowest.homeTeam} ${lowest.homeScore} - ${lowest.visitorTeam} ${lowest.visitorScore} (Ukupno: ${lowest.totalPoints})`
        );

        console.log("Prosek poena domacina:", analyzer.averageHomeScore().toFixed(2));

        await plotTotalPoints(analyzer.games);
    } catch (err) {
        console.error("Greska:", err);
    }
})();