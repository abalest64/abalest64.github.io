args <- commandArgs(trailingOnly = TRUE)
user_email <- tolower(trimws(if (length(args) >= 1) args[1] else ""))

escape_json <- function(value) {
  gsub('"', '\\"', value, fixed = TRUE)
}

official_data <- list(
  "a.r.balest@email.msmary.edu" = list(
    stats = list(
      season_avg = 193,
      strike_pct = 52,
      spare_pct = 71,
      single_pin_pct = 84,
      split_pct = 22,
      fill_pct = 79
    ),
    trends = list(
      list(tournament_name = "24-10-06 MERCYHURST INVITATIONAL", avg_score = 186),
      list(tournament_name = "24-11-03 NIAGARA FALL INVITE", avg_score = 190),
      list(tournament_name = "24-11-17 CSU FLYING EAGLES INVITE", avg_score = 192),
      list(tournament_name = "24-11-24 GARDEN STATE CLASSIC", avg_score = 188),
      list(tournament_name = "25-01-19 NORTHEAST CLASSIC", avg_score = 196),
      list(tournament_name = "25-02-09 MOUNT SHOOTOUT", avg_score = 201),
      list(tournament_name = "25-02-16 JBI INVITATIONAL", avg_score = 198),
      list(tournament_name = "25-03-02 STALLINGS INVITE", avg_score = 194),
      list(tournament_name = "25-03-09 ITC SECTIONALS", avg_score = 197)
    )
  ),
  "s.calo@email.msmary.edu" = list(
    stats = list(
      season_avg = 187,
      strike_pct = 46,
      spare_pct = 68,
      single_pin_pct = 80,
      split_pct = 19,
      fill_pct = 74
    ),
    trends = list(
      list(tournament_name = "24-10-06 MERCYHURST INVITATIONAL", avg_score = 179),
      list(tournament_name = "24-11-03 NIAGARA FALL INVITE", avg_score = 183),
      list(tournament_name = "24-11-17 CSU FLYING EAGLES INVITE", avg_score = 185),
      list(tournament_name = "24-11-24 GARDEN STATE CLASSIC", avg_score = 181),
      list(tournament_name = "25-01-19 NORTHEAST CLASSIC", avg_score = 189),
      list(tournament_name = "25-02-09 MOUNT SHOOTOUT", avg_score = 191),
      list(tournament_name = "25-02-16 JBI INVITATIONAL", avg_score = 188),
      list(tournament_name = "25-03-02 STALLINGS INVITE", avg_score = 186),
      list(tournament_name = "25-03-09 ITC SECTIONALS", avg_score = 190)
    )
  )
)

if (!nzchar(user_email) || is.null(official_data[[user_email]])) {
  cat('{"success":false,"message":"No official stats mapping found for that player."}')
  quit(status = 1)
}

entry <- official_data[[user_email]]
stats <- entry$stats

stats_json <- sprintf(
  paste0(
    '{"player_email":"%s","season_avg":%s,"strike_pct":%s,',
    '"spare_pct":%s,"single_pin_pct":%s,"split_pct":%s,"fill_pct":%s}'
  ),
  escape_json(user_email),
  stats$season_avg,
  stats$strike_pct,
  stats$spare_pct,
  stats$single_pin_pct,
  stats$split_pct,
  stats$fill_pct
)

trend_json <- vapply(
  entry$trends,
  function(item) {
    sprintf(
      '{"player_email":"%s","tournament_name":"%s","avg_score":%s}',
      escape_json(user_email),
      escape_json(item$tournament_name),
      item$avg_score
    )
  },
  character(1)
)

cat(
  sprintf(
    '{"success":true,"stats":%s,"trends":[%s]}',
    stats_json,
    paste(trend_json, collapse = ",")
  )
)
