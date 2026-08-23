library(dplyr)
library(DBI)
library(RMariaDB)

# 1. Read CSV
filename <- "stats.csv"
df <- read.csv(filename, stringsAsFactors = FALSE)

# 2. Extract specific stats for BALEST (Mapping based on file structure)
balest_rows <- df %>% filter(grepl("BALEST", X, ignore.case = TRUE))

# Summary Row (The last row usually contains season totals)
summary <- tail(balest_rows, 1)

# Tournament Trend (Taking the individual event rows)
trend <- head(balest_rows, 5)

# 3. Format Data
final_stats <- data.frame(
  player_email = "a.r.balest@email.msmary.edu",
  strike_pct = round(as.numeric(summary$X.27) * 100, 1),
  spare_pct = round(as.numeric(summary$X.40) * 100, 1),
  single_pin_pct = round(as.numeric(summary$X.46) * 100, 1),
  split_pct = round(as.numeric(summary$X.57) * 100, 1),
  fill_pct = round(as.numeric(summary$X.11) * 100, 1),
  season_avg = as.numeric(summary$X.5)
)

trend_data <- data.frame(
  player_email = "a.r.balest@email.msmary.edu",
  tournament_name = c("Event 1", "Event 2", "Event 3", "Event 4", "Event 5"),
  avg_score = as.numeric(trend$X.5)
)

# 4. Save to Database
con <- dbConnect(RMariaDB::mariadb(), user='root', password='Bowling300!', dbname='bowling_db', host='localhost')
dbWriteTable(con, "player_stats", final_stats, overwrite = TRUE, row.names = FALSE)
dbWriteTable(con, "tournament_stats", trend_data, overwrite = TRUE, row.names = FALSE)
dbDisconnect(con)